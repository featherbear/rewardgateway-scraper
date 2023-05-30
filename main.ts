import dotenv from 'dotenv'
import bunyan from 'bunyan'
import puppeteer from 'puppeteer'
import fs from 'fs'

const logger = bunyan.createLogger({ name: "RewardGateway Scraper", level: 'debug' })
dotenv.config()

let { SITE, USERNAME, PASSWORD } = process.env

if (!SITE || !USERNAME || !PASSWORD) {
    logger.fatal("not all environment variables set")
    process.exit(1)
}

const getAddress = (page: string) => `https://${SITE}/${page}`


enum Files {
    merchants = "merchants.json",
    offers = "offers.json"
}

type MerchantData = {
    retailer_id: string,
    merchant: string,
    logo: string,
    description: string,
    value: string
}


async function run(mode: 'merchants' | 'offers') {
    async function initialise() {
        let instance = await puppeteer.launch({ waitForInitialPage: false, headless: false })
        let page = await (instance.pages().then(pages => pages[0]) || instance.newPage())

        /**
         * Authentication
         */

        await page.goto(getAddress('signin'))

        logger.info("Authenticating")
        logger.debug("Typing username")
        await page.type("input[data-automation=Username]", USERNAME!)
        logger.debug("Typing password")
        await page.type("input[data-automation=Password]", PASSWORD!)


        logger.debug("Click login")
        await page.evaluate(() => {
            (<HTMLButtonElement>document.querySelector('button[data-automation=submit')).click();
        });
        await page.waitForNetworkIdle()

        return [instance, page] as const
    }

    if (mode == 'merchants') {
        /**
         * Scrape merchants
         */

        const [instance, page] = await initialise()
        let levelOneTargets: string[] = [getAddress('/Search?sType=Category&sFields[c]=')]

        async function levelOneScrape(url: string) {
            await page.goto(url)
            let merchants = await page.$$('div.list_view > .item')
            let results = merchants.map((merchant) => merchant.evaluate((element) => {
                let valueElem = (<HTMLElement>element.querySelector('div.price div.amount'))
                return {
                    retailer_id: (<HTMLElement>element).dataset.retailer_id!,
                    merchant: (<HTMLElement>element.querySelector('div.item_details h3')).childNodes[0].nodeValue!.trim(),
                    logo: (<HTMLImageElement>element.querySelector('a.logo img.retailer-logo')).src,
                    description: (<HTMLElement>element.querySelector('p:not(:first-child)'))!.textContent!,
                    value: valueElem ? valueElem.textContent!.trim() : ''
                } satisfies MerchantData
            }))


            let b = await page.$('#retailers-list-results-pagination > li > a.selected')

            let nextPage = await b?.evaluate(el => {
                let nextEl = el.parentElement!.nextElementSibling
                if (nextEl) return (<HTMLAnchorElement>nextEl.querySelector('a')).href
            })

            return [await Promise.all(results), nextPage || null] as const
        }

        let i = 0;

        let levelOneResults: MerchantData[] = []
        while (levelOneTargets.length > 0) {
            i++;
            logger.debug({ page: i }, "Scraping page")
            let [merchants, nextPage] = await levelOneScrape(levelOneTargets.shift()!)
            if (nextPage) levelOneTargets.push(nextPage)
            levelOneResults.push(...merchants)
        }

        logger.info({ count: levelOneResults.length }, "Scraped merchants")
        fs.writeFileSync(Files.merchants, JSON.stringify(levelOneResults, null, 2))

        instance.close()
    }

    else if (mode == 'offers') {
        /**
         * Scrape offers from merchants
        */
        let merchants: MerchantData[] = []
        try {
            if (!fs.existsSync(Files.merchants)) throw new Error(`${Files.merchants} does not exist`)
            merchants = JSON.parse(fs.readFileSync(Files.merchants).toString())
            logger.info({ count: merchants.length }, "Merchants file loaded")
        } catch (e) {
            logger.fatal({ reason: (<Error>e).message }, "Could not parse merchants file")
            process.exit(1)
        }

        /**
         * Rate limit protection is hard, at least we tried
         */
        const workers = 1
        const constantDelay = 0;

        let batches: Array<MerchantData[]> = []
        for (var i = 0; i < merchants.length; i += Math.ceil(merchants.length / workers)) {
            batches.push(merchants.slice(i, i + Math.ceil(merchants.length / workers)));
        }

        // Sanity check
        {
            const count = batches.reduce((counter, items) => counter += items.length, 0)
            if (count !== merchants.length) {
                logger.fatal(
                    { count, expected: merchants.length },
                    "Someone sucks at coding. Split mismatch"
                )
                process.exit(1)
            }
        }
        batches.forEach((batch, idx) => logger.info({ worker: idx, queue: batch.length }, "Batch created"))

        logger.info("Spawning workers")
        const puppeteerInitialsedResult = await initialise()
        const workerInstances = [
            puppeteerInitialsedResult[1],
            ...await Promise.all(
                Array.from(Array(workers - 1).keys()).map(
                    () => puppeteerInitialsedResult[0].newPage()
                )
            )
        ]

        // Another sanity check
        if (workers !== batches.length) {
            logger.fatal(
                { count: workerInstances.length, expected: workers },
                "Someone sucks at coding. Worker mismatch"
            )
            process.exit(1)
        }

        async function delay(timeout: number): Promise<void> {
            return new Promise((resolve, reject) => setTimeout(() => resolve(), timeout))
        }

        let result = {}

        // Exponential back-off
        let rateLimit = 1;

        if (constantDelay) logger.info("Expect at least a wait of " + batches[0].length * constantDelay + "ms")

        await Promise.all(workerInstances.map(async (worker, idx) => {
            while (batches[idx].length > 0) {
                let merchant = batches[idx].shift()!

                if (rateLimit > 1) await delay(rateLimit * 1000)

                if (constantDelay) await delay(constantDelay) // Always add a delay
                logger.debug({ merchant: merchant.merchant, id: merchant.retailer_id, worker: idx, queueRemaining: batches[idx].length }, "Scraping offers")
                let response = await worker.goto(getAddress(`Merchant?m=${merchant.retailer_id}`))
                if (response?.status() != 200) {
                    // Probably rate-limited
                    logger.warn({ merchant: merchant.merchant, id: merchant.retailer_id, worker: idx, rateLimit }, "Rate limit encountered")
                    if (rateLimit < 16) {
                        rateLimit *= 2;
                        logger.debug({ rateLimit, worker: idx }, "Rate limit incremented")
                    }

                    batches[idx].unshift(merchant)
                    continue
                } else {
                    if (rateLimit > 1) {
                        rateLimit = 1
                        logger.debug({ rateLimit, worker: idx }, "Rate limit decremented")
                    }
                }

                let offers = await worker.$$('div.offers_swappable_container > div.offers_swappable_content')
                let result = await Promise.all(offers.map(section => section.evaluate((el) => {
                    let sections = el.querySelector('h2.retailer_offer_sections')
                    if (!sections) return []

                    let category = sections.textContent!.trim()

                    let offers: { category: string, value: string }[] = []
                    el.querySelectorAll('div.offer_block').forEach(el => {
                        let value = el.querySelector('div.offer_discount > span.offer')
                        if (!value) return

                        offers.push({
                            category,
                            value: value!.textContent!.replace(/\s+/g, ' ').trim()
                        })
                    })

                    return offers
                })))
                result[merchant.retailer_id] = result.flat()
            }
        }))

        logger.info("Scraped merchant offers")
        fs.writeFileSync(Files.offers, JSON.stringify(result, null, 2))

        puppeteerInitialsedResult[0].close()
    } else {
        logger.fatal({command: mode}, "Unknown command")
    }
}

run(<any>process.argv[2])

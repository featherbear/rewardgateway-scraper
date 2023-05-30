# RewardsGateway Viewer

---

> https://featherbear.cc/rewardgateway-scraper/

Supply the query parameters

* `merchants` - Link to a JSON file containing `MerchantData[]`
* `offers` - Link to a JSON file containing `{[retailer_id]: OfferData[]}`
* `title` (optional) - A string to be used as the page title


> For example (with relevant CORS access to `somesite.com`)

```
https://featherbear.cc/rewardgateway-scraper/?merchants=https://somesite.com/merchants.json&offers=https://somesite.com/offers.json&title=An%20%Example%20Site
```

---

## File Format
### Merchants

> `MerchantData[]`

```ts
type MerchantData = {
  retailer_id: string;
  merchant: string;
  logo: string;
  description: string;
  value: string;
};
```

## Offers

> `{[retailer_id]: OfferData[]}`

```ts
type OfferData = {
  category: string;
  value: string;
};
```

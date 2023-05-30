<script lang="ts">
  import { onMount } from "svelte";
  import { createFuse } from "./lib/fuse";

  type MerchantData = {
    retailer_id: string;
    merchant: string;
    logo: string;
    description: string;
    value: string;
  };
  type OfferData = {
    category: string;
    value: string;
  };

  let fuse = createFuse<MerchantData>([], ["merchant", "retailer_id"]);
  let merchants: MerchantData[] = [];
  let offers: { [retailer_id: string]: Array<OfferData> } = {};

  let siteOptions = {
    merchantsAddress: null,
    offersAddress: null,
    title: "RewardGateway Corporate Program",
  };

  onMount(async () => {
    let search = new URLSearchParams(location.search);

    let encoded = search.get("d");
    if (encoded) search = new URLSearchParams(atob(encoded));

    let merchantsAddress = search.get("merchants");
    if (merchantsAddress) siteOptions.merchantsAddress = merchantsAddress;

    let offersAddress = search.get("offers");
    if (offersAddress) siteOptions.offersAddress = offersAddress;

    let title = search.get("title");
    if (title) siteOptions.title = title;

    merchants = await fetch(siteOptions.merchantsAddress)
      .then((r) => r.json())
      .catch(() => []);
    merchants.sort((a, b) => a.merchant.localeCompare(b.merchant));
    fuse.setCollection(merchants);

    offers = await fetch(siteOptions.offersAddress)
      .then((r) => r.json())
      .catch(() => ({}));
  });

  let searchValue: string = "";
  let searchResults: MerchantData[] = [];
  $: {
    searchResults = searchValue
      ? fuse.search(searchValue).map(({ item }) => item)
      : merchants;
  }
</script>

<svelte:head>
  <title>{siteOptions.title}</title>
</svelte:head>

<main>
  <h1>{siteOptions.title}</h1>

  <div class="searchContainer">
    <input
      bind:value={searchValue}
      class="search"
      placeholder="Search for merchant"
    />
  </div>

  <section>
    {#each searchResults as merchant (merchant.retailer_id)}
      <div class="card">
        <div class="merchant">
          <div class="logoContainer">
            <img src={merchant.logo} alt="logo for {merchant.merchant}" />
          </div>
          <div class="name">{merchant.merchant}</div>
        </div>
        {#if offers[merchant.retailer_id]?.length > 0}
          <section class="offers">
            {#each offers[merchant.retailer_id] as entry}
              <div class="offer">
                {entry.category} - {entry.value}
              </div>
            {/each}
          </section>
        {:else}
          No offers
        {/if}
      </div>
    {:else}
      No merchants found
    {/each}
  </section>
</main>

<style lang="scss">
  $borderRadius: 5px;
  $borderThickness: 2px;
  $borderColour: grey;

  .card {
    border: $borderThickness solid $borderColour;
    border-radius: $borderRadius;

    .merchant {
      border-bottom-left-radius: $borderRadius;
      border-bottom-right-radius: $borderRadius;
      border-bottom: $borderThickness dotted $borderColour;
    }

    .offer:not(:last-child) {
      border-bottom: 1px solid grey;
    }
  }

  $clamping: clamp(320px, 80vw, 760px);
  .searchContainer {
    position: sticky;
    top: 0;
    // background-color: white;
    // border-bottom: $borderThickness dotted $borderColour;

    padding: 2px 0;

    .search {
      width: $clamping;
      text-align: center;
      font-size: 1.6em;
      padding: 10px 0;
    }
  }

  .card {
    padding: 0;

    width: $clamping;

    &:not(:last-child) {
      margin-bottom: 10px;
    }
    cursor: pointer;

    .merchant {
      display: flex;
      flex-direction: row;
      place-items: center;
      padding: 5px;

      > .name {
        font-size: 1.6em;
        font-weight: bold;
      }
      > .logoContainer {
        display: inherit;
        height: 50px;
        width: 80px;
        margin-right: 20px;
        user-select: none;
        pointer-events: none;

        > img {
          object-fit: contain;
        }
      }
    }

    .offers {
      display: flex;
      flex-direction: column;
      text-align: left;

      > .offer {
        padding: 5px;

        will-change: background-color;
        transition: background-color 0.1s;
        &:hover {
          background-color: rgb(255, 233, 198) !important;
        }
        &:nth-child(2n + 1) {
          background-color: darken(white, 5%);
        }
      }
    }
  }
</style>

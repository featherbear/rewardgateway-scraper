<script lang="ts">
  import { onMount } from "svelte";
  import { createFuse } from "./lib/fuse";
  import ToggleButton from "./ToggleButton.svelte";

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
  let merchantsSorted: MerchantData[] = [];
  let offers: { [retailer_id: string]: Array<OfferData> } = {};

  let siteOptions = {
    merchantsAddress: null,
    offersAddress: null,
    title: "RewardGateway Corporate Program",
    sortAlpha: false,
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
    merchantsSorted = [...merchants].sort((a, b) =>
      a.merchant.localeCompare(b.merchant)
    );

    fuse.setCollection(merchants);

    offers = await fetch(siteOptions.offersAddress)
      .then((r) => r.json())
      .catch(() => ({}));
  });

  let searchValue: string = "";
  let searchResults: MerchantData[] = [];
  $: {
    let source = siteOptions.sortAlpha ? merchantsSorted : merchants;
    searchResults = searchValue
      ? fuse.search(searchValue, { limit: 50 }).map(({ item }) => item)
      : source;
  }
</script>

<svelte:head>
  <title>{siteOptions.title}</title>
</svelte:head>

<main>
  <h1>{siteOptions.title}</h1>

  <div class="searchContainer">
    <div>
      <input
        bind:value={searchValue}
        class="search"
        placeholder="Search for merchant"
      />
      <div>
        Sort alphabetically
        <ToggleButton bind:checked={siteOptions.sortAlpha} />
      </div>
    </div>
  </div>

  <section class="content">
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
    box-sizing: border-box;

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
    background-color: white;
    width: $clamping;

    > div {
      border: 1px solid black;
      display: flex;
      flex-direction: row;
      background-color: white;
      // box-shadow: 0 10px 20px -8px #c5d6d6;

      .search {
        flex: 1;
        outline: none;
        border: none;
        text-align: center;
        font-size: 1.6em;
        padding: 10px 0;
      }
    }
  }

  .content {
    margin-top: 20px;
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

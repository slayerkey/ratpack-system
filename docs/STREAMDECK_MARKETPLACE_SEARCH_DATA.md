# Stream Deck Marketplace Search Data

## Canonical snapshot

The current machine readable snapshot lives at `data/marketplace/streamdeck_search_popularity.json`.

The snapshot was captured on 2026 08 29 from the public Query Suggestions index used by Elgato Marketplace search.

It contains the current top 100 search terms, their popularity, their strict exact product result count, their leading exact result categories, and selected visual theme terms relevant to PackRat icon and art work.

## Meaning of the fields

`popularity` is a raw rolling 30 day search popularity value based on unique users. It is not a score capped at 100.

`exact_product_hits` is the number of strict exact Marketplace results stored for that query by the Query Suggestions builder. It is a useful competition signal, but it is not a count of products sold.

`rank` is the position returned by the public suggestion index at the time of capture.

## How RatPack should use it

1. Use popularity to confirm that a term has actual Marketplace search activity.

2. Compare popularity with exact product hits when evaluating demand against visible supply.

3. Use a keyword in a product title, description, gallery, or art direction only when it truthfully describes the product.

4. Do not select an unrelated visual theme merely because its search popularity is high.

5. Treat the snapshot as dated evidence. Refresh it before making a major product decision when the file is more than 30 days old.

6. Never interpret popularity as sales, revenue, conversion rate, or a normalized score out of 100.

## Current visual theme read

The snapshot shows stronger search activity for cyberpunk than for neon, pastel, anime, sakura, kawaii, or minimalist.

Anime has a popularity value of 16 with 18 strict exact products.

Sakura has a popularity value of 15 with only 4 strict exact products.

Kawaii has a popularity value of 13 with only 5 strict exact products.

For a genuinely matching product, combined positioning such as Anime Sakura Icons can target related demand without keyword stuffing.

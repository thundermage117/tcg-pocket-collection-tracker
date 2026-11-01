# TCG Pocket Collection Tracker: personal fork

A single-user fork of [TCG Pocket Collection Tracker](https://github.com/marcelpanse/tcg-pocket-collection-tracker) by Marcel Panse and contributors. It tracks my Pokémon TCG Pocket collection, and adds card value data and the pages that use it.

Want to track your own collection? Use the original at [tcgpocketcollectiontracker.com](https://tcgpocketcollectiontracker.com). This fork runs for one account and has new sign-ups turned off.

## What's different from upstream

- **Card value**: ☆☆ community vote Elo, plus trade demand and wishlist counts, on every card. The collection can be sorted by value.
- **Rankings**: SSS–E tier lists, by ☆☆ Elo and by how wanted a card is in trades.
- **Packs**: boosters ranked by a goal you pick, such as cards you're missing or the best average card.
- **Trade**: "Looking for" and "For trade" lists from your collection, copyable as Discord messages, plus a fair / steal / overpay check for any one-for-one trade.
- **Overview**: a completion heatmap by set × rarity.
- **Phone-first navigation**, and filters kept in the URL.
- Social features (friends, chat, trade matching) are unlinked.

Value data comes from [pokemontcglivetrade.org](https://pokemontcglivetrade.org) and [pokemon.eleet.dev](https://pokemon.eleet.dev), refreshed twice a month. Upstream changes are merged in automatically each week.

## Docs

[FORK.md](../FORK.md) covers every added feature, how to set up your own copy (Supabase, Vercel, GitHub Actions), how upstream merges work, and where the value numbers come from.

Upstream's README, with its technology overview and contributor list, is at [README.md](../README.md).

## License

GPL-3.0, the same as upstream ([LICENSE](../LICENSE)). The fork's changes are on the `personal` branch; `main` mirrors upstream.

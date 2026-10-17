# Project Guidance

## User Preferences

- Keep the English interface spacious and restrained, with gold as an accent.
- Use verified official standards imagery where available.
- Use verified current app figures in the corrected white paper and preserve the original separately.
- Keep historical account and transaction data intact.

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- Route / renders pages/LandingPage.tsx full-width (sections own their container); other routes keep container py-12. Landing sections live in components/landing/*; MobileBuyBar shows between #top hero bottom and #join closing CTA.
- The crest PNG (1024px, named dim_200x200) has a baked-in checkerboard; always render it via CrestLogo (exported from Footer.tsx), a rounded-full overflow-hidden frame with scale >= 1.25.
- /buy-icp is public: actor-gated on-ramp query falls back to default providers when signed out; account-specific info only when signed in. GetIcpFirstPanel on Exchange reuses the INSUFFICIENT_ICP validation or a zero balance.
- Ledger is ICRC-1/2/3/10 standard: block Value is variant {Nat; Int; Text; Blob; Array; Map}; new blocks are Map with btype (1xfer/2approve/1mint/1burn), ts, fee?, fee_col?, phash, tx; legacy ':' blocks kept as #Text at original indexes (decimals per getLegacyBlockInfo boundary); migration 20261013_210000.mo stored lastBlockHash and a dedup index.
- icrc3_get_blocks serves all ranges with a 100-block cap; icrc3_get_archives returns []; dedup window 24h + 2 min drift; memo max 32 bytes; MIN_BURN 100; fee bounds 0..10000 via get_fee_bounds; set_fee returns {ok; err}.
- Freeze blocks transfers, mint, burn, deliverFromCollectorOrMint and presale purchases (PurchaseErrorCode #transfersFrozen) before ICP is collected; exact buys cap cost at min(caller maxIcpE8s, maxIcpFor(backend quote)).
- getTreasuryConfig, getConversions, getFailedForwards and retryTreasuryForward are admin-only; public pages use getPublicTreasuryInfo (mode, marginBps, icpAccount); frontend gates admin queries on isCallerAdmin; setTreasuryConfig returns {Ok; Err} with marginBps <= 2000 and rate > 0.
- Non-trapping admin check: accessControlState.userRoles.get(caller) == ?#admin (AccessControl.isAdmin traps for unregistered principals).
- Frontend block decoding lives in lib/icrc3Blocks.ts (decodeBlock, encodeIcrcAccountText, decodeTipHashTree); account text uses standard ICRC-1 encoding (lib/token.ts encodeAccountText).
- In OQL .sample(...) literals, annotate records with their declared type so optional numeric fields match Nat64-based Timestamp.
- The crest is now /assets/generated/ttti-emblem.dim_1024x1024.png, a minimalist gold line-art winged helmet with the TTTI wordmark on a black badge with double gold rings. It replaces the old checkerboard crest, which is kept but unused. CrestLogo in Footer.tsx renders it with scale-[1.15].
- generate_image adds .dim_WxH to file names, so always use the frontendSrc path it returns. The favicon is set in Caffeine Settings, so never add favicon tags.
- Standards badges live in public/assets/badges/ (icrc1-token-standard.png, icrc2-token-standard.png, on-chain-100.png copied from the press kit; icrc3-token-standard.svg is an unofficial vector recreation traced from the ICRC-2 template) and render in a gold-bordered strip under the grid in components/landing/TokenDetailsSection.tsx; the On-Chain seal sits on an ivory circle backing.
- The public token card in components/TokenInfo.tsx is the single location for subdued ICRC-1/2/3 wording; ICRC-10 remains a discovery endpoint rather than a public feature badge.
- The token card prominently shows maximum supply, total supply, price and fee; symbol, decimals and fee collector sit in a disclosure.
- A unique gold on-chain seal belongs at the upper-right of the TTTI Presale card.
- TransferPage guards the reserved minting-account destination before transfer, while useTttiIcrc2Approve invalidates the displayed token balance after the approval fee.
- Frontend typecheck, formatting and build passed; desktop and mobile mock-backed views rendered without console errors. Source review checked displayed standards against methods but did not certify third-party interoperability.
- The original DOCX is byte-identical to the uploaded file and is immediately available as a static download; an authenticated administrator visiting White Paper initiates its integrity-checked object-storage publication.
- Public offering copy calls the token TTTI-T (Test), while the existing ICRC ledger symbol remains TTTI-P to preserve wallet compatibility and history.
- The white-paper page distinguishes original draft from revised source-aligned edition, including 8 decimals and test allocation of 1 token.
- Both purchase modes require an explicit reading acknowledgement before approval or purchase.
- Frontend typecheck, formatting, and build passed; source review verified purchase gating and token labels, with initial object-storage publication contingent on an administrator visit.
- The TTTI emblem asset is /assets/generated/ttti-emblem.dim_1024x1024.png (now the bronze/antique-gold embossed medallion with a stylized face and TTTI lettering on black). CrestLogo in Footer.tsx is the single render path for it (header brand, mobile menu title, hero, closing CTA, footer, sign-in dialog), so swapping that one asset updates every site; index.html og:image/twitter:image point at the same path.
- Copying an uploaded attachment into public/assets requires a workspace-root-relative cp (cp .platform/attachments/<file> app/src/frontend/public/assets/...); the write tool stores the path string as text, not the binary.

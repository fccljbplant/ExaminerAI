# Uploaded Agent Pack reconciliation

**Decision:** use the uploaded pack as a review reference, not as a repository overlay. The owner approved creating the local `MERGE-01` task card and reconciling the pack on 2026-11-10. The current `AGENT-INSTRUCTIONS.md` and the owner-approved local integration exception in `docs/PROJECT-CONTINUITY.md` remain authoritative.

## Retained as compatible practice

- One narrowly scoped task card per session.
- Verify source files and APIs before relying on them; distinguish evidence from assumptions.
- Record real check results, gaps and next steps in project continuity documents.
- Respect the stated weekday UTC off-peak windows for any designated DeepSeek upgrade-agent work.

These practices are recorded in the local `QUEUE.md` and this handoff; no old automation is required to apply them to this documentation-only task.

## Not installed

- `AGENTS.md`: the uploaded copy says it is mandatory and model-specific, assumes a runner-created `upgrade/phase-*` branch, and conflicts with the current local-only consolidation exception and the live `AGENT-INSTRUCTIONS.md` branch workflow. Installing it would create competing instruction authorities.
- `opencode.json` and `.opencode/plugins/offpeak-guard.js`: not installed. The plugin's `remoteDatabaseConfigured()` reads `.env`, `.env.local` and `.env.production` (uploaded file, `.opencode/plugins/offpeak-guard.js`, lines 9â€“17), which violates the project's no-`.env*`-access rule. The plugin was ¶»§q«^uÍÉŒ½µ½‘Õ±•Ì½Õ¤µØÌ½ØÌµÍ¡•±°¹ÑÍá€°„€ØÜàµ±¥¹”ØÌµÍ¡•±°¹ÍÍ€°Á½ÉÑ…°…¹±…ÍÍÉ½½´É•İÉ¥Ñ•Ì°ÍÉŒ½…ÁÀ½…Á¤½…‘µ¥¸½Õ¤µØÌ½É½ÕÑ”¹ÑÍ€°™•…ÑÕÉ”µ™±…œ¡…¹•Ì°±½­™¥±”¡…¹•Ì…¹„ÑÉ…­•ME1¥Ñ”¡…¹”¸]¡½±•Í…±”¥¹Ñ•É…Ñ¥½¸¥ÌÉ•©•Ñ•¸9¼¥Í½±…Ñ•™•…ÑÕÉ”İ…ÌÁ½ÉÑ•¥¸5I´ÀÄ¸(´µ…¥¹€É•µ…¥¹ÌÕ¹¡…¹•…Ğ™ŒÜÁ„ÈäÙˆÈàÌÌÑ™˜ĞÕ”áˆÀàÅ„Á˜á™”å„ÀÜÁ‰”Í„Ñ€¸9¼ÁÕÍ °AHµ•É”°‘•Á±½åµ•¹Ğ°ÁÉ½‘ÕÑ¥½¸½Á•É…Ñ¥½¸½È‰É…¹ ‘•±•Ñ¥½¸½ÕÉÉ•¸((ŒŒ]¡äÑ¡”XÌ‰É…¹ É•µ…¥¹Ì½¸¡½±()Q¡”ÕÁ±½…‘•5…ÍÑ•ÈUÁÉ…‘”AÉ½µÁĞƒ
ÈÉ•ÅÕ¥É•ÌÑ¡”•á¥ÍÑ¥¹œÑ½­•¸ÍåÍÑ•´°…‘…ÁÑ¥Ù”Í¡•±°…¹U$­¥Ğ°…¹•áÁ±¥¥Ñ±äÉ•©•ÑÌ„Í•½¹‘•Í¥¸ÍåÍÑ•´¸Q¡”‰É…¹ …‘‘Ì„Í•Á…É…Ñ”XÌÍ¡•±°…¹ÍÑå±•Í¡••Ğ…¹¡…¹•ÌÍ¡…É•Á½ÉÑ…°½±…ÍÍÉ½½´Á…Ñ¡Ì¸á¥ÍÑ¥¹œ½¹Ñ¥¹Õ¥Ñä¹½Ñ•Ì…±Í¼É•½ÉÉ½±”µÕ…É°İ••­±äµÑ•ÍĞÍ•±•Ñ½È°±…ÍÍÉ½½´¡É½µ”…¹É•É•ÍÍ¥½¸µÑ•ÍĞ½¹•É¹Ì¸™ÕÑÕÉ”Á½ÉĞµÕÍĞ‰”½¹”™•…ÑÕÉ”…Ğ„Ñ¥µ”°ÕÍ¥¹œ•á¥ÍÑ¥¹œÑ½­•¹Ì½Í¡•±°½U$­¥Ğ°¥¹‘•Á•¹‘•¹Ñ±ä…Ñ•Á•ÈÁ½ÉÑ…°°İ¥Ñ Í•ÉÙ•ÈµÍ¥‘”I	½Ñ•¹…¹Ğ½½ÕÉÍ”¡•­Ì…¹É•ÍÁ½¹Í¥Ù”½…•ÍÍ¥‰¥±¥ÑäÉ•É•ÍÍ¥½¸•Ù¥‘•¹”¸((ŒŒÙ¥‘•¹”…¹±¥µ¥Ñ…Ñ¥½¹Ì((´1¥Ù”ÁÉ½©•Ğ½¹Ñ¥¹Õ¥Ñäè‘½Ì½AI=)Pµ=9Q%9U%Qd¹µèİ€É•½É‘ÌÑ¡”±½…°µ½¹±ä½İ¹•È•á•ÁÑ¥½¸…¹XÌİ¡½±•Í…±”µµ•É”É•ÍÑÉ¥Ñ¥½¸¸(´1¥Ù”ÍÑ…ÑÕÌè‘½Ì½AI=)PµMQQUL¹µèÌ´ÄÁ€É•½É‘ÌÑ¡”¥¹Ñ•É…Ñ•É•™Ì°ÕÉÉ•¹Ğµ…¥¸M!°Ñ•ÍĞ‰…Í•±¥¹”…¹XÌ‘•™•ÉÉ…°¸(´1¥Ù”™±…œ¥µÁ±•µ•¹Ñ…Ñ¥½¸èÍÉŒ½±¥ˆ½™•…ÑÕÉ”µ™±…Ì¹ÑÌèÈÌ´ĞÙ€‘•ÍÉ¥‰•Ì‘•™…Õ±Ğµ½™˜Á•ÈµÁ½ÉÑ…°É½±±½ÕĞ…¹™…¥°µ±½Í•‰•¡…Ù¥½È¸(´UÁ±½…‘•Á±Õ¥¸‰•¡…Ù¥½Èè€¹½Á•¹½‘”½Á±ÕÚîÆ­y
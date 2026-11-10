# Branch-consolidation task queue

This is a narrowly scoped local integration queue. `AGENT-INSTRUCTIONS.md` and `docs/PROJECT-CONTINUITY.md` remain the governing project instructions. This queue does not install or override the uploaded Agent Pack's `AGENTS.md`, OpenCode configuration, plugin or automation runner.

## Local branch consolidation

### CARD MERGE-01 â€” Reconcile Agent Pack and safely disposition all supplied branches
- status: done
- depends: none
- effort: high
- budget: 120m
- read: `AGENT-INSTRUCTIONS.md`; `docs/PROJECT-CONTINUITY.md`; `docs/PROJECT-STATUS.md`; `docs/UPGRADE-2026-10/QUESTIONS.md`; uploaded `agent-pack.zip` sections `AGENTS.md`, `QUEUE.md`, `START-HERE.md`, `scripts/agent/run-logged.mjs`, `.opencode/plugins/offpeak-guard.js`; uploaded Master Upgrade Prompt Â§F2.
- do:
  1. Reconfirm integration branch, worktree, main and fetched branch refs. Keep all work local.
  2. Compare the uploaded Agent Pack with current repository instructions and source. Do not install stale or conflicting files wholesale.
  3. Inspect the unique `master` / `backup/v3-ui` delta against the integration branch. Merge only changes that are independently safe and compatible with the existing design system, portal flags, access controls and tests.
  4. Record the disposition of each supplied branch and any excluded changes. Preserve all original refs.
  5. Update project continuity, status, progress and session logs. Run `git diff --check`; review the complete documenta¶»§q«^u•´Á…ÍÍ•Ñ¡”¥¹‘•Á•¹‘•¹ĞµÁ½ÉĞ…Ñ”¸Q¡”±…å½ÕÑÌ…É”½ÕÁ±•Ñ¼XÍM¡•±±€…¹¡…¹”É½±”½Á½ÉÑ…°µ™±…œ‰•¡…Ù¥½ÈìXÌÉ•µ½Ù•ÌÕÉÉ•¹ĞÍ¡•±°•áÁ½ÉÑÌ…¹±…ÍÍÉ½½´™¥±•Ì¸%ÑÌ±•…É¹•Èµ•¹Ô…‘‘¥Ñ¥½¹ÌÉ•ÅÕ¥É”„¹…Ù¥…Ñ¥½¸‘•¥Í¥½¸‰•…ÕÍ”•á¥ÍÑ¥¹œ%É½ÕÁÌÍÍ¥¹µ•¹ÑÌÕ¹‘•È1•…É¸…¹5•ÍÍ…•ÌÕ¹‘•È!•±À°İ¡¥±”U$µMQ9ILƒ
œä…¹Ñ¡”±¥Ù”Í¡•±°‘•ÍÉ¥‰”‘¥™™•É•¹Ğ±•…É¹•È¹…Ù¥…Ñ¥½¸µ½‘•±Ì¸M•”EUMQ%=9L¹µ‘€€ ÈÀÈØ´ÄÄ´ÄÄ¤¸-••À½¸¡½±ì‘¼¹½Ğ¥µÁ½ÉĞXÌÍ¡•±°½¹…Ø¸(((ŒŒŒI5I´ÀÌƒŠPI•ÍÑ½É”Ñ¡”±•…É¹•È½ÕÉÍ”µ…Ñ…±½œÉ½ÕÑ”…±¥…Ì(´ÍÑ…ÑÕÌè‘½¹”(´‘•Á•¹‘Ìè5I´ÀÄ(´•™™½ÉĞè±½Ü(´‰Õ‘•Ğè€ÌÁ´(´É•…è‘½Ì½U$µMQ9IL¹µ‘€ì‘½Ì½UAI´ÈÀÈØ´ÄÀ½‘•Í¥¸½I=1µM%8µ%M%=9L¹µ‘€ì‘½Ì½IM%8µ@ÌµAµMAL´ÈÀÈØ´Àà´ÄĞ¹µ‘€ƒ
0ËŠM0ÌìÍÉŒ½µ½‘Õ±•Ì½±•…É¹•ÈµÁ½ÉÑ…°½¹…Ø¹ÑÍ€ìÍÉŒ½…ÁÀ¼¡Á½ÉÑ…±Ì¤½±•…É¹•È½±•…É¸½Á…”¹ÑÍá€¸(´‘¼è(€€Ä¸A½ÉĞ½¹±äÑ¡”XÌ‰É…¹ Ì½ÉÁ¡…¹•€½±•…É¹•È½½ÕÉÍ•Í€¥¹‘•àÉ½ÕÑ”¥¹Ñ•¹Ğ°¹½Ğ¥ÑÌÍ¡•±°½ÈU$½µÁ½¹•¹ÑÌ¸(€€È¸I•‘¥É•ĞÑ¼Ñ¡”•á¥ÍÑ¥¹œ€½±•…É¹•È½±•…É¹€…Ñ…±½œìÁÉ•Í•ÉÙ”Ñ¡”Á…É•¹Ğ±•…É¹•È±…å½ÕĞÌ…ÕÑ ½I	½Á½ÉÑ…°…Ñ•Ì¸(€€Ì¸‘„™½ÕÍ•É½ÕÑ”Ñ•ÍĞ…¹ÉÕ¸Ñ…É•Ñ•±¥¹Ğ°Ñ•ÍĞ°ÑåÁ•¡•¬…¹‘¥™˜¡•­Ì¸(€€Ğ¸I•½ÉÑ¡…ĞÑ¡¥Ì¥Ì„É½ÕÑ”…±¥…Ì°¹½Ğ„‘•‘¥…Ñ••¹É½±±•µ½¹±ä5ä1•…É¹¥¹œÙ¥•Ü¸(´‘½¹”İ¡•¸è€½±•…É¹•È½½ÕÉÍ•Í€É•Í½±Ù•ÌÑ¡É½Õ Ñ¡”•á¥ÍÑ¥¹œÁÉ½Ñ•Ñ•±•…É¹•È±…å½ÕĞÑ¼Ñ¡”…¹½¹¥…°…Ñ…±½œ°İ¥Ñ Ñ•ÍĞ•Ù¥‘•¹”…¹¹¼‘•Í¥¸µÍåÍÑ•´½È‘…Ñ„µÍ½Á”¡…¹•Ì¸(´™½É‰¥è¥µÁ½ÉÑ¥¹œÕ¤µØÍ€°…‘‘¥¹œ±½‰…°U$™±…Ì°¡…¹¥¹œ…ÕÑ ½I	°…ÕÑ¼µÍ•±•Ñ¥¹œ„½ÕÉÍ–ÚîÆ­y
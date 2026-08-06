"""Extract the conversation content from a Qwen chat share link."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    url = "https://chat.qwen.ai/s/deploy/t_10f6d1e1-7684-4857-8d0d-72e206de814e"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)  # let the SPA render

        # Extract all text content from the page
        text = await page.evaluate("""
            () => {
                // Get all text nodes, filter out script/style
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                const texts = [];
                let node;
                while (node = walker.nextNode()) {
                    const t = node.textContent.trim();
                    if (t && t.length > 1) {
                        // Skip parent script/style
                        const parent = node.parentElement;
                        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) continue;
                        texts.push(t);
                    }
                }
                return texts.join('\\n---\\n');
            }
        """)

        print(text[:15000])  # Print first 15K chars
        await browser.close()

asyncio.run(main())

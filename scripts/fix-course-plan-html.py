#!/usr/bin/env python3
"""
Modify the bootcamp HTML file to:
1. Remove the dark/light theme toggle button + its JS
2. Sync with the app's next-themes (reads localStorage 'theme' key)
3. Listen for real-time theme changes via storage event + postMessage
"""
import re
from pathlib import Path

SRC = Path("/home/z/my-project/upload/Modern_Web_Dev_AI_Bootcamp_Weeks_1-6.html")
DST = Path("/home/z/my-project/public/course-plan.html")

html = SRC.read_text(encoding="utf-8")

# ---- 1. Replace the theme init script (lines ~9-17) ----
# Old: reads 'examinerai-plan-theme' localStorage key
# New: reads 'theme' key (next-themes), handles 'system' via prefers-color-scheme
old_init = """<script>
  // Runs before first paint to avoid a flash of the wrong theme.
  (function () {
    try {
      var saved = localStorage.getItem('examinerai-plan-theme');
      var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
</script>"""

new_init = """<script>
  // Sync theme with parent app (next-themes stores in localStorage 'theme' key).
  // Runs before first paint to avoid a flash of the wrong theme.
  (function () {
    function resolveTheme() {
      try {
        var saved = localStorage.getItem('theme');
        if (saved === 'dark') return 'dark';
        if (saved === 'light') return 'light';
        if (saved === 'system' || !saved) {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
      } catch (e) { return 'light'; }
    }
    document.documentElement.setAttribute('data-theme', resolveTheme());
    // Expose for real-time updates
    window.__resolveExaminerTheme = resolveTheme;
  })();
</script>"""

assert old_init in html, "Could not find theme init script"
html = html.replace(old_init, new_init)

# ---- 2. Remove the theme toggle button (lines ~292-294) ----
old_button = """  <button id="theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">
    <span class="icon-sun">☀️</span><span class="icon-moon">🌙</span>
  </button>"""

assert old_button in html, "Could not find theme toggle button"
html = html.replace(old_button, "  <!-- Theme toggle removed — synced with parent app -->")

# ---- 3. Remove the theme toggle JS (lines ~3081-3087) ----
old_toggle_js = """  // Dark / light theme toggle, persisted for next time this file is opened.
  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('examinerai-plan-theme', next); } catch (e) {}
  });"""

assert old_toggle_js in html, "Could not find theme toggle JS"
html = html.replace(old_toggle_js, """  // Theme is synced with the parent app — listen for changes.
  // next-themes stores in localStorage 'theme' key. When it changes
  // (user clicks the app's theme toggle), update this page too.
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme' && window.__resolveExaminerTheme) {
      document.documentElement.setAttribute('data-theme', window.__resolveExaminerTheme());
    }
  });
  // Also listen for postMessage from parent (for same-origin iframes)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'theme-change' && window.__resolveExaminerTheme) {
      document.documentElement.setAttribute('data-theme', window.__resolveExaminerTheme());
    }
  });
  // Poll for theme changes every 500ms (fallback if storage event doesn't fire
  // — happens when the toggle is in the same tab as this iframe)
  setInterval(() => {
    if (window.__resolveExaminerTheme) {
      var current = document.documentElement.getAttribute('data-theme');
      var resolved = window.__resolveExaminerTheme();
      if (current !== resolved) {
        document.documentElement.setAttribute('data-theme', resolved);
      }
    }
  }, 500);""")

# ---- 4. Add a small note in the topbar that the theme follows the app ----
# The topbar now has empty space where the button was. Let's add a subtle
# "theme follows app" indicator instead.
html = html.replace(
    "  <!-- Theme toggle removed — synced with parent app -->",
    "  <span class=\"theme-follows-app\" title=\"Theme follows the main app\">⟳ follows app theme</span>"
)

# Write the modified file
DST.write_text(html, encoding="utf-8")
print(f"✓ Written {DST} ({len(html)} bytes)")
print(f"  - Removed theme toggle button")
print(f"  - Removed theme toggle JS")
print(f"  - Replaced theme init to read 'theme' key (next-themes)")
print(f"  - Added storage + postMessage + polling listeners")

import puppeteer from "puppeteer-core";

export const maxDuration = 300;

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHROME_PROFILE = "C:\\Users\\djthi\\AppData\\Local\\Google\\Chrome\\User Data";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (log: string, status?: string) => {
        const payload = JSON.stringify({ log, status: status ?? "running" });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      try {
        send("Launching Chrome with your saved credentials...");

        const browser = await puppeteer.launch({
          executablePath: CHROME_PATH,
          userDataDir: CHROME_PROFILE,
          headless: false,
          defaultViewport: null,
          args: [
            "--start-maximized",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-blink-features=AutomationControlled",
          ],
        });

        const pages = await browser.pages();
        const page = pages[0] ?? (await browser.newPage());

        send("Navigating to FigurePOS.com...");
        await page.goto("https://www.figurepos.com", { waitUntil: "domcontentloaded" });

        send("Waiting for auto-login (up to 60 seconds)...");

        // Wait until we're no longer on a login/landing page
        await page.waitForFunction(
          () => {
            const url = window.location.href;
            const hasPasswordField = !!document.querySelector('input[type="password"]');
            const isLoginPage =
              url.includes("/login") ||
              url.includes("/signin") ||
              url === "https://www.figurepos.com/" ||
              url === "https://figurepos.com/";
            return !hasPasswordField && !isLoginPage;
          },
          { timeout: 60000 }
        );

        send("Logged in! Searching for Timesheets in Management...");

        // Wait for Timesheets link to appear in the sidebar
        await page.waitForFunction(
          () => {
            const all = Array.from(document.querySelectorAll("a, button, li, span, div"));
            return all.some(
              (el) =>
                el.textContent?.trim().toLowerCase() === "timesheets" ||
                el.textContent?.trim().toLowerCase() === "timesheet"
            );
          },
          { timeout: 15000 }
        );

        // Click it
        await page.evaluate(() => {
          const el = Array.from(document.querySelectorAll("a, button, li, span, div")).find(
            (el) =>
              el.textContent?.trim().toLowerCase() === "timesheets" ||
              el.textContent?.trim().toLowerCase() === "timesheet"
          );
          (el as HTMLElement)?.click();
        });

        send("Navigated to Timesheets! Ready for next step.", "done");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("user data directory is already in use")) {
          send(
            "ERROR: Chrome is already open with your profile. Please close Chrome first, then run the job again.",
            "error"
          );
        } else {
          send(`ERROR: ${msg}`, "error");
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

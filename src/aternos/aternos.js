import puppeteer from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { getText, isVisible, waitForFirst } from "./puppeteer-helper.js";
import UserAgent from "user-agents";

puppeteer.use(stealthPlugin());

const hostname = "https://aternos.org";

const to = {
  default: 10000,
  start: 300000,
  stop: 60000,
};

const si = {
  stopped: "div.statuslabel i.fas.fa-stop-circle",
  started: "div.statuslabel i.fas.fa-play-circle",
  waiting: "div.statuslabel i.fas.fa-clock",
  loading: "div.statuslabel i.fas.fa-spinner-third",
};

async function findServer(page, id) {
  let server = id && (await page.$(`[data-id="${id}"]`));
  if (!server) {
    const servers = await page.$$("div.server-body");
    for (const srv of servers) {
      if (!id || (await getText(srv, ".server-name")) === id) {
        return srv;
      }
    }
  }
  return server;
}

async function getServerID(page) {
  return await getText(
    page,
    "div.navigation-server-detail.navigation-server-id"
  );
}

async function getServerName(page) {
  return await getText(page, "div.navigation-server-name");
}

async function getPlayers(page) {
  let players = await getText(page, "#players");
  if (players) {
    players = players.split("/");
    return {
      current: players[0].trim() * 1,
      max: players[1].trim() * 1,
    };
  }
}

async function getSoftware(page) {
  return await getText(page, "#software");
}

async function getVersion(page) {
  return await getText(page, "#version");
}

async function getQueue(page) {
  let time = await getText(page, "span.server-status-label-left");
  let people = await getText(
    page,
    "span.server-status-label-right.queue-position"
  );
  if (time && people) {
    people = people.split("/");
    return {
      time: time.replace(".ca", "").replace("min", "").trim() * 60,
      position: people.lengh > 0 && people[0].trim() * 1,
      waiting: people.lengh > 1 && people[1].trim() * 1,
    };
  }
}

async function getStatus(page) {
  const status = {};

  if (await isVisible(page, si.stopped)) {
    status.id = 0;
  } else if (await isVisible(page, si.started)) {
    status.id = 1;
    status.countdown = await getText(page, "span.server-status-label-left");
    status.memory = await getText(
      page,
      "span.server-status-label-right.queue-position"
    );
  } else if (await isVisible(page, si.waiting)) {
    status.id = 2;
    status.queue = await getQueue(page);
  } else if (await isVisible(page, si.loading)) {
    status.id = 3;
  } else {
    status.id = -1;
  }

  if (await waitForFirst(page, to.default, ".statuslabel-label")) {
    status.text = await getText(page, ".statuslabel-label");
  }

  return status;
}

async function getServerInfo(page) {
  let info = {};

  try {
    info.id = await getServerID(page);
    info.name = await getServerName(page);
    info.status = await getStatus(page);
    info.players = await getPlayers(page);
    info.software = await getSoftware(page);
    info.version = await getVersion(page);
  } catch (err) {
    info.error = err.message;
  }

  return info;
}

async function sleep(time) {
  await new Promise((res) => setTimeout(res, time));
}

async function connect(id, req) {
  const startPage = hostname + "/go";
  let browser,
    info,
    time = new Date();

  const userAgent = new UserAgent();

  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(userAgent.toString());
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(startPage);

    await page.screenshot({ path: "screenshot.png" });

    
    await page.type("#user", process.env.ATERNOS_USER);
    await page.type("#password", process.env.ATERNOS_PASSWORD);
    await page.click("#login");

    await page.waitForFunction(
      () => {
        let le = document.querySelector("div.login-error");
        le = le && le.textContent.trim() !== "";
        return le || document.querySelector("div.page-content.page-servers");
      },
      { timeout: to.default }
    );

    const error = await getText(page, "div.login-error");
    if (error) {
      throw error;
    }

    const server = await findServer(page, id);

    if (!server) {
      throw `Server ${id} not found`;
    }

    const [response] = await Promise.all([
      page.waitForNavigation(), // The promise resolves after navigation has finished
      server.click(),
    ]);

    const choices = await page.$("#accept-choices");
    if (choices) {
      await choices.click();
    }

    info = await getServerInfo(page);

    if (req) {
      await req(page, info);
    }
  } catch (error) {
    console.log(error);
    info.error = error.message;
  } finally {
    if (browser) {
      await browser.close();
    }
    info.elapsed = new Date() - time;
    return info;
  }
}

export function start(id, wait) {
  return connect(id, async (page, info) => {
    if (info.status.id !== 0) {
      return;
    }

    try {
      await page.click("#start");
      await page.waitForTimeout(1000);

      await page.waitForSelector("a.btn.btn-green", { timeout: to.default });
      let confirmation = await page.$("a.btn.btn-green");
      if (confirmation) {
        await confirmation.click();
        await page.waitForTimeout(1000);
      }

      if (!page.url().includes("server")) {
        await page.goto(hostname + "/server");
      }

      await waitForFirst(page, to.start, si.started, si.waiting);
      await page.waitForTimeout(1000);

      if (wait && (await isVisible(si.waiting))) {
        const queue = await getQueue(page);
        await page.waitForSelector("#confirm", {
          timeout: queue.time * 1000,
          visible: true,
        });
        await page.click("#confirm");
        await page.waitForTimeout(1000);
        await page.waitForSelector(si.started, { timeout: to.start });
      }

      info.status = await getStatus(page);
    } catch (error) {
      info.error = error.message;
    }
  });
}

export function stop(id) {
  return connect(id, async (page, info) => {
    if (info.status.id === 0) {
      return;
    }

    try {
      await page.click("#stop");
      await page.waitForTimeout(1000);

      await page.waitForSelector(si.stopped, { timeout: to.stop });

      info.status = await getStatus(page);
    } catch (error) {
      info.error = error.message;
    }
  });
}

export function restart(id) {
  return connect(id, async (page, info) => {
    if (info.status.id !== 1) {
      return;
    }

    try {
      await page.click("#restart");
      await page.waitForTimeout(1000);

      await page.waitForSelector(si.started, { timeout: to.start });

      info.status = await getStatus(page);
    } catch (error) {
      info.error = error.message;
    }
  });
}

export function getInfo(id) {
  return connect(id, async (page, info) => {
    try {
      await page.goto(hostname + "/log");
      await page.click("div.mclogs-share.btn.btn-main.btn-large.btn-no-margin");
      await page.waitForTimeout(1000);
      await page.waitForSelector("div.share-dropdown-output", {
        timeout: to.default,
        visible: true,
      });
      info.log = await ph.getText(page, "div.share-dropdown-output");
    } catch (error) {
      info.error = error;
    }
  });
}

export async function getHostname(id) {
  try {
    const info = await getInfo(id);
    return `${info.name}.aternos.me`;
  } catch (error) {}
}

export async function isVisible(context, selector) {
  try {
    return await context.evaluate((selector) => {
      const e = document.querySelector(selector);
      if (e) {
        const style = window.getComputedStyle(e);
        return (
          style &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      } else {
        return false;
      }
    }, selector);
  } catch (e) {}
}

export async function getText(context, selector) {
  try {
    const element = await context.$(selector);
    const text = await element
      .getProperty("innerText")
      .then((e) => e.jsonValue());
    if (text) {
      return text;
    }
  } catch (error) {}
}

export async function getProperty(context, selector, property) {
  try {
    let item = await context.$(selector);
    if (item) {
      item = await item.getProperty(property);
      if (item) {
        return item.jsonValue();
      }
    }
  } catch (e) {}
}

export async function waitForFirst(context, timeout, ...selectors) {
  try {
    const elements = [];
    for (let selector of selectors) {
      elements.push(
        context.waitForSelector(selector, { timeout, visible: true }).catch()
      );
    }
    await Promise.race(elements);
    return true;
  } catch (e) {
    return false;
  }
}



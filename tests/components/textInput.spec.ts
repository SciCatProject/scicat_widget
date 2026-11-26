import { test, expect } from "@playwright/test";
import { expectEvent, expectNoEvent, mount } from "./util";

test.beforeEach(async ({ page }) => {
    await page.goto("/");
});

test("emits event on blur", async ({ page }) => {
    await mount(page, "text", "My text", {});

    const input = page.getByLabel("My text");
    await input.fill("Lorem ipsum");
    await input.blur();

    await expectEvent(page, {
        key: "My text",
        value: "Lorem ipsum",
        userTriggered: true,
    });
});

test("emits event on enter", async ({ page }) => {
    await mount(page, "text", "My text", {});

    const input = page.getByLabel("My text");
    await input.fill("Lorem ipsum");
    await input.press("Enter");

    await expectEvent(page, {
        key: "My text",
        value: "Lorem ipsum",
        userTriggered: true,
    });
});

test("trims input", async ({ page }) => {
    await mount(page, "text", "My text", {});

    const input = page.getByLabel("My text");
    await input.fill(" Lorem ipsum  ");
    await input.press("Enter");

    await expectEvent(page, {
        key: "My text",
        value: "Lorem ipsum",
        userTriggered: true,
    });
});

test("non-editable input can be set programmatically", async ({ page }) => {
    await page.evaluate(() => {
        const [input, container] = window.createInputComponent("text", "My text", {});
        window.setRootChildren(container);
        input.disableEditing();
        // Simulates a value that is derived from other fields after editing
        // was disabled, e.g., by a field factory.
        input.setSignaling("Lorem ipsum", false);
    });

    const input = page.getByLabel("My text");
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue("Lorem ipsum");
    await expect(page.locator(".cean-clear-button")).toBeDisabled();
});

test("can be multiline", async ({ page }) => {
    await mount(page, "text", "My text", { multiline: true });

    const input = page.getByLabel("My text");
    await input.fill("Lorem ipsum");
    await input.press("Enter"); // inserts a new line
    await input.press("N");

    // Enter does not emit an event
    await expectNoEvent(page);

    // Now we get an event
    await input.blur();
    await expectEvent(page, {
        key: "My text",
        value: "Lorem ipsum\nN",
        userTriggered: true,
    });
});

test("allows good email", async ({ page }) => {
    await mount(page, "text", "Your email:", { type: "email" });

    const input = page.getByLabel("Your email:");
    await input.fill("testo@check.mail");

    const error = await page.locator(".cean-status").textContent();
    expect(error).toBeFalsy();

    await input.press("Enter");
    await expectEvent(page, {
        key: "Your email:",
        value: "testo@check.mail",
        userTriggered: true,
    });
});

test("flags bad email", async ({ page }) => {
    await mount(page, "text", "Your email:", { type: "email" });

    const input = page.getByLabel("Your email:");
    await input.fill("not.a.mail");

    const status = page.locator(".cean-status");
    expect(await status.textContent()).toBeTruthy();

    await input.press("Enter");
    await expectNoEvent(page);

    // Inserting a good email removes error message
    await input.fill("good@mail.test");
    expect(await status.textContent()).toBeFalsy();

    await input.press("Enter");
    await expectEvent(page, {
        key: "Your email:",
        value: "good@mail.test",
        userTriggered: true,
    });
});

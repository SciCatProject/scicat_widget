// These tests need to use Jupyter because they rely on the comms framework
// and Python for loading files.

import { expect, galata, test } from "@jupyterlab/galata";

import * as path from "path";
import { Locator } from "@playwright/test";

test.describe("MultiFileInput", () => {
    test.beforeEach(async ({ page, tmpPath }) => {
        const contents = galata.newContentsHelper(undefined, page);
        await contents.uploadDirectory(path.resolve(__dirname, "./assets"), tmpPath);
        await page.filebrowser.refresh();
    });

    test("Add and remove files via paths", async ({ page }) => {
        const nbPath = "dataset_upload_widget_minimal.ipynb";
        await page.notebook.openByPath(nbPath);
        await page.notebook.activate(nbPath);
        const widgetCell = 0;
        for (let i = 0; i <= widgetCell; i++) {
            expect(await page.notebook.runCell(i)).toBe(true);
        }
        const locator = await page.notebook.getCellOutputLocator(widgetCell);
        if (locator === null) throw new Error("Could not find output locator");

        await locator.getByRole("tab", { name: /Files/ }).click();
        const fileInput = locator.getByLabel("Input new file");

        // ----- Add 2 files -----
        await fileInput.fill("scicat.png");
        await fileInput.press("Enter");
        // Wait for the file to be added, if we proceeded without this, the
        // file might not get registered in time.
        await expect(locator.getByLabel("Remote path")).toHaveCount(1);

        await fileInput.fill(nbPath);
        await fileInput.press("Enter");
        await expect(locator.getByLabel("Remote path")).toHaveCount(2);

        await expectFile(locator, 0, "scicat.png");
        await expectFile(locator, 1, nbPath);

        // ----- Remove 1st file -----
        await locator
            .locator(".cean-selected-file-item")
            .nth(0)
            .getByTitle("Remove item")
            .click();
        await expect(locator.getByLabel("Remote path")).toHaveCount(1);
        await expectFile(locator, 0, nbPath);

        // ----- Add another file -----
        await fileInput.fill("data.csv");
        await fileInput.press("Enter");
        await expect(locator.getByLabel("Remote path")).toHaveCount(2);
        await expectFile(locator, 0, nbPath);
        await expectFile(locator, 1, "data.csv");

        // ----- Remove all files -----
        await locator
            .locator(".cean-selected-file-item")
            .nth(0)
            .getByTitle("Remove item")
            .click();
        await locator
            .locator(".cean-selected-file-item")
            .nth(0)
            .getByTitle("Remove item")
            .click();
        await expect(locator.getByLabel("Remote path")).toHaveCount(0);

        // ----- Add 1st file back in -----
        await fileInput.fill("scicat.png");
        await fileInput.press("Enter");
        await expect(locator.getByLabel("Remote path")).toHaveCount(1);
        await expectFile(locator, 0, "scicat.png");
    });

    test("Add files via file browser", async ({ page }) => {
        const nbPath = "dataset_upload_widget_minimal.ipynb";
        await page.notebook.openByPath(nbPath);
        await page.notebook.activate(nbPath);
        const widgetCell = 0;
        for (let i = 0; i <= widgetCell; i++) {
            expect(await page.notebook.runCell(i)).toBe(true);
        }
        const locator = await page.notebook.getCellOutputLocator(widgetCell);
        if (locator === null) throw new Error("Could not find output locator");

        await locator.getByRole("tab", { name: /Files/ }).click();
        const browseButton = locator.getByRole("button", { name: "Browse" });

        await browseButton.click();
        const dialog = page.locator(".jphf-dialog");
        await dialog.getByRole("cell", { name: "data.csv" }).click();
        await dialog.getByRole("button", { name: "Select file" }).click();

        await expect(locator.getByLabel("Remote path")).toHaveCount(1);
        await expectFile(locator, 0, "data.csv");
    });

    test("Shows warning icon when files are invalid due to duplicate names", async ({
        page,
    }) => {
        const nbPath = "dataset_upload_widget_minimal.ipynb";
        await page.notebook.openByPath(nbPath);
        await page.notebook.activate(nbPath);
        const widgetCell = 0;
        for (let i = 0; i <= widgetCell; i++) {
            expect(await page.notebook.runCell(i)).toBe(true);
        }
        const locator = await page.notebook.getCellOutputLocator(widgetCell);
        if (locator === null) throw new Error("Could not find output locator");

        await locator.getByRole("tab", { name: /Files/ }).click();
        const fileInput = locator.getByLabel("Input new file");

        // Add 2 distinct files
        await fileInput.fill("scicat.png");
        await fileInput.press("Enter");
        await expect(locator.getByLabel("Remote path")).toHaveCount(1);

        await fileInput.fill("data.csv");
        await fileInput.press("Enter");
        await expect(locator.getByLabel("Remote path")).toHaveCount(2);

        const fileItems = locator.locator(".cean-selected-file-item");
        const warningIcons = locator.locator(".cean-file-warning-icon");

        // Both should be valid initially
        await expect(warningIcons.nth(0)).toBeHidden();
        await expect(warningIcons.nth(1)).toBeHidden();

        // Change remote path of second file to duplicate the first ("scicat.png")
        const remoteInput1 = fileItems.nth(1).getByLabel("Remote path");
        await remoteInput1.fill("scicat.png");
        await remoteInput1.press("Enter");

        // Both should now show warning icons and duplicate file name errors
        await expect(warningIcons.nth(0)).toBeVisible();
        await expect(warningIcons.nth(1)).toBeVisible();
        await expect(fileItems.nth(0).locator(".cean-error")).toContainText(
            "Duplicate file name",
        );
        await expect(fileItems.nth(1).locator(".cean-error")).toContainText(
            "Duplicate file name",
        );

        // Change remote path back to a unique name
        await remoteInput1.fill("other.png");
        await remoteInput1.press("Enter");

        // Both warning icons should be hidden again
        await expect(warningIcons.nth(0)).toBeHidden();
        await expect(warningIcons.nth(1)).toBeHidden();
    });
});

async function expectFile(
    locator: Locator,
    index: number,
    localPath: string | RegExp,
    remotePath: string | RegExp | null = null,
) {
    expect(
        await locator.getByLabel("Local path").nth(index).textContent(),
        `File ${index} Local path`,
    ).toBe(localPath);

    // We can't read the placeholder, so check that an
    // input with this placeholder exists as the next best option.
    await expect(locator.getByPlaceholder(remotePath ?? localPath)).toHaveCount(1);
}

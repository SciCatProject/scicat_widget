import galataConfig from "@jupyterlab/galata/lib/playwright-config";
import { defineConfig, devices } from "@playwright/test";

const FIXTURE_PORT = 8000;
const JUPYTER_PORT = 8080;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    ...galataConfig,

    testIgnore: "**/.ipynb_checkpoints/**",

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    retries: process.env.CI ? 1 : 0,
    reportSlowTests: null,
    timeout: 10_000,

    fullyParallel: false,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,

    reporter: [[process.env.CI ? "github" : "list"], ["html"]],
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        trace: "on-first-retry",
        video: "retain-on-failure",
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: "components-chromium",
            testDir: "./tests/components",
            testMatch: /.*\.spec\.ts$/,
            use: {
                ...devices["Desktop Chrome"],
                baseURL: `http://localhost:${FIXTURE_PORT}`,
            },
        },
        {
            name: "components-firefox",
            testDir: "./tests/components",
            testMatch: /.*\.spec\.ts$/,
            use: {
                ...devices["Desktop Firefox"],
                baseURL: `http://localhost:${FIXTURE_PORT}`,
            },
        },
        // TODO missing dependencies
        // {
        //     name: "components-webkit",
        //     testDir: "./tests/components",
        //     testMatch: /.*\.spec\.ts$/,
        //     use: {
        //         ...devices["Desktop Safari"],
        //         baseURL: `http://localhost:${FIXTURE_PORT}`,
        //     },
        // },

        {
            name: "jupyter-chromium",
            testDir: "./tests/jupyter",
            testMatch: /.*\.spec\.ts$/,
            timeout: 60_000, // Jupyter setup is slow
            workers: 1, // tests can be flaky with multiple workers
            use: {
                ...devices["Desktop Chrome"],
                baseURL: `http://localhost:${JUPYTER_PORT}`,
            },
        },
        {
            name: "jupyter-firefox",
            testDir: "./tests/jupyter",
            testMatch: /.*\.spec\.ts$/,
            timeout: 60_000, // Jupyter setup is slow
            workers: 1, // tests can be flaky with multiple workers
            use: {
                ...devices["Desktop Firefox"],
                baseURL: `http://localhost:${JUPYTER_PORT}`,
            },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: [
        {
            command: `npm run fixture:serve -- --serve=${FIXTURE_PORT}`,
            url: `http://localhost:${FIXTURE_PORT}`,
            reuseExistingServer: false,
        },
        {
            // JupyterLab for Galata
            command:
                "npm run build && " +
                "pixi run _jupyter-test lab --config ./tests/jupyter/jupyter_server_test_config.py " +
                `--port=${JUPYTER_PORT}`,
            url: `http://localhost:${JUPYTER_PORT}/lab`,
            timeout: 120_000,
            reuseExistingServer: false,
        },
    ],
});

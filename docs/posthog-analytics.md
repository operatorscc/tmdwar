# PostHog analytics for TMD-WAR

## Status and configuration

PostHog is optional. Analytics does not initialize unless `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is set in the deployment environment. Configure these values in Vercel Project Settings > Environment Variables for the intended Preview environment first:

- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`: Project API key from the intended PostHog project's Project Settings > Project Details. This is a browser-visible project token, not a Personal API Key.
- `NEXT_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com` for PostHog US Cloud.

Do not commit tokens into source. Do not copy a Personal API Key into a `NEXT_PUBLIC_*` variable.

## Privacy defaults

- Autocapture is disabled.
- Automatic pageviews and pageleave events are disabled.
- Session recording is disabled in the SDK.
- Persistence is memory-only.
- No user identification, email, account ID, bid amount, payment details, form contents, URL query string, or URL hash is sent.
- The only event emitted is `tmd_public_page_view`, with a pathname-only `path` property.
- Tracking is skipped for paths beginning with `/admin`, `/auth`, `/login`, `/logout`, `/signup`, `/register`, `/account`, `/profile`, `/checkout`, `/payment`, `/payments`, `/finance`, `/finence`, or `/api`.

Session replay must remain disabled for this integration. Do not enable it globally in PostHog or add replay overrides without a separate privacy review.

## Preview verification checklist

1. Add the token and host only to the Vercel Preview environment for this branch.
2. Confirm the preview build and automated tests pass.
3. Open a public catalogue page and verify that `tmd_public_page_view` arrives in the intended PostHog project.
4. Verify the event contains only `path` and that the path has no query string or hash.
5. Navigate to admin, finance, authentication, and account pages; confirm no `tmd_public_page_view` event is emitted for those paths.
6. Confirm session recordings remain absent and autocapture is disabled.
7. Do not add production environment variables or merge/deploy to production until the review and Preview checks are complete.

The source intentionally does not identify signed-in users and does not track bids, auction actions, payments, or financial information.

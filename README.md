# Benachi & Mohamed — GitHub portfolio

The portfolio loads public profile information and repositories from GitHub. Private repository metadata is fetched by the Vercel API only after Benachi or Mohamed signs in with GitHub. OAuth is used only to confirm which collaborator signed in; its access token is not retained. The server uses the GitHub App's private key to obtain short-lived installation tokens, and only for app installations on the two approved accounts. Secrets never enter browser JavaScript.

## Deploy to Vercel

1. Import this repository as a project in Vercel. The root page is static; files in `api/` are Vercel Functions.
2. Create a GitHub App under **Settings → Developer settings → GitHub Apps**:
   - Set the homepage URL to the deployed portfolio URL.
   - Set the user authorization callback URL to `https://YOUR-DOMAIN/api/auth/callback`.
   - Set **Where can this GitHub App be installed?** to **Any account**, so both collaborators can install it.
   - Keep **Repository permissions → Metadata: Read-only** (the required default). Do not grant Contents or other repository permissions: this site only lists repository metadata and links to GitHub; it does not read source files.
   - Do not grant write permissions. Webhooks are not needed.
   - Generate a client secret. Keep the client secret private.
3. Install the GitHub App on **both** collaborator accounts, selecting only the private repositories you want listed. The app receives metadata access only for repositories selected in each installation. After either collaborator signs into the portfolio, it can list the selected repositories from both accounts.
4. Add these environment variables in the Vercel project settings and redeploy:

   | Variable | Value |
   | --- | --- |
   | `GITHUB_APP_ID` | The numeric App ID from the GitHub App's **General** settings |
   | `GITHUB_APP_CLIENT_ID` | The GitHub App's client ID |
   | `GITHUB_APP_CLIENT_SECRET` | The client secret generated for the GitHub App |
   | `GITHUB_APP_PRIVATE_KEY` | The full contents of the private-key `.pem` file generated for the GitHub App |
   | `SITE_URL` | The portfolio's canonical HTTPS URL, with no trailing slash |
   | `AUTH_SECRET` | A fresh base64-encoded 32-byte secret |

   Generate `AUTH_SECRET` locally with Node.js:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Save the generated value directly in Vercel's environment variable settings. Do not commit it to the repository or put it in frontend code.

   Paste the private key into Vercel's encrypted environment variable settings, preserving its PEM header and footer. Never add the private key or generated auth secret to this repository.

5. Redeploy after setting the environment variables. Open the deployed portfolio and sign in as `Cyberfox2005` or `Mohking999`. These are the only accounts permitted to view private repository metadata. A private repository appears only when the App is installed on the owner's account and that repository is selected.

Sessions are encrypted, HTTP-only, restricted to the two collaborator accounts, and expire within eight hours. Signing out clears the local session. The app installation token is requested with metadata read-only permission and is never sent to the browser. Public profile and repository information remains public.

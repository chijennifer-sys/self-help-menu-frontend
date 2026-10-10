# Put the help menu on the internet

This guide is for you, by hand, in the GitHub website. You do not need to
install anything.

This repository is the **menu people see**. It is public.

The **roster and the Google script** live in a different repository:
[chijennifer-sys/self-help-menu-backend](https://github.com/chijennifer-sys/self-help-menu-backend).
Sheet links, script ids, and deployment ids go there, never here.

When these steps are done, the menu is at:

<https://chijennifer-sys.github.io/self-help-menu-frontend/>

Until the backend is connected, that address shows five made-up people so you
can click through the menu. That is expected.

---

## 1. Open the right repository

1. Sign in to GitHub.
2. Open <https://github.com/chijennifer-sys/self-help-menu-frontend>.
3. You need permission to change settings on this repository. If Settings is
   missing, ask the account owner to do this step.

**Check:** The address bar ends in `chijennifer-sys/self-help-menu-frontend`,
and the repository is marked Public.

---

## 2. Turn on GitHub Pages, and set the source to GitHub Actions

1. On that repository, click **Settings**.
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment**, find **Source**.
4. Choose **GitHub Actions**.

Do not choose **Deploy from a branch**. A branch deploy will not run this
repository's workflow, and the menu will not update when the code changes.

If you do not see a Pages section at all, the GitHub account may be blocking
Pages. An owner has to allow it. There is nothing else to click until that
is allowed.

**Check:** The Pages screen says the source is **GitHub Actions**. It does
not say "Deploy from a branch".

---

## 3. Leave Actions allowed to run

1. Still in **Settings**, click **Actions**, then **General**.
2. Under **Actions permissions**, leave actions allowed. **Allow all actions**
   is the usual choice and is fine.
3. Under **Workflow permissions**, **Read repository contents** is enough.
   This menu's workflow asks for the Pages publish permission itself.
4. Do not add any Actions secrets on this repository. There is no
   `CLASPRC_JSON`, no `SCRIPT_ID`, and no `DEPLOYMENT_ID` here. Those three
   belong only on the backend repository.

**Check:** You added no secrets on `self-help-menu-frontend`. The backend
repository is the only place with those three names.

---

## 4. Publish the menu

The site updates only when the `main` branch changes.

1. Click the **Actions** tab.
2. If GitHub asks you to enable Actions on this repository, click the button
   that enables them.
3. Merge the setup pull request into `main`, or, if it is already merged,
   wait for the run named **Deploy to GitHub Pages**.
4. Open that run. It has two jobs: **check**, then **deploy**.

The first deploy can fail if step 2 was not done yet. Fix the Pages source,
then open the failed run and click **Re-run jobs**. You do not need a new
code change.

**Check:** The **Deploy to GitHub Pages** run shows a green tick. Open
<https://chijennifer-sys.github.io/self-help-menu-frontend/>
and the menu loads. Give it a minute after the green tick. If you see a
404, wait one minute and refresh once.

---

## 5. Confirm the demo menu works

Do this before you connect the real roster.

1. On your phone, open
   <https://chijennifer-sys.github.io/self-help-menu-frontend/>.
2. You should see five boards: **I am still in my country**, **I just
   arrived**, **I am working**, **Living in the USA**, **My program is
   ending**. All five should sit on the screen above the bottom bar. Nothing
   should slide sideways.
3. Under the question "Put in your Student ID…", you should see the word
   **Preview**, the words **Demo data**, and the buttons **52341**,
   **53880**, **61200**, and **Ivan**.
4. Tap **52341**. The page should greet **Andrei Ionescu**, working at
   **Aramark** in **Ocean City, NJ**, and open the board that matches those
   dates.
5. Tap one question and read the answer. The words should be that person's
   own employer and dates, not a blank `{employer}` or `{dsStartF}`.
6. Tap **Not you?** The name clears and the demo buttons come back.

**Check:** 52341 shows Andrei Ionescu at Aramark, a question opens without
an empty panel, and the page does not ask you to scroll sideways to see the
five boards.

These five people are fiction. They are not on the real roster.

---

## 6. Where the backend address goes

The real menu calls a Google web app. Its address ends in `/exec`. You get
that address from the backend setup, after the web app has been deployed
once by hand. It looks like:

`https://script.google.com/macros/s/` + a long code + `/exec`

It must end in `/exec`. An address that ends in `/dev` is the wrong one.

To put it in this repository:

1. On GitHub, open the file `assets/config.js`.
2. Click the pencil (**Edit this file**).
3. Find this line:

   `const ENDPOINT = '';`

4. Put the address between the quotes:

   `const ENDPOINT = 'https://script.google.com/macros/s/your-code/exec';`

5. Do not paste a Google Sheet link. Do not paste a Drive folder link.
   Do not paste a Script id. This one address is the only backend detail
   that belongs in this file.
6. Click **Commit changes**. Leave **Commit directly to the `main` branch**
   selected, then confirm.

**Check:** `assets/config.js` shows your `/exec` address and nothing else
new. The **Deploy to GitHub Pages** run goes green again.

### Do not do step 6 on its own

Right now, that address only hides the **Preview / Demo data** strip.
The page still answers from the five made-up people. It does not call the
backend yet.

The three lookup functions that would call the backend are in
`assets/app.js`, not in `config.js`. The written brief and the Wiring screen
on the menu do not agree on the exact replacement, so that edit is an open
question. It is listed in the setup pull request. Do not copy the code off
the Wiring screen. It is an older sketch and it will not line up with the
page.

Leave `ENDPOINT` empty until that question is settled and both edits land
in the same change. If you save the address first, the demo buttons
disappear and real students still cannot be found.

---

## 7. The check that waits until the backend is connected

Do this only after the `/exec` address is saved **and** the three lookup
functions have been switched over.

1. From the backend roster, copy one person's **Menu Link**. It contains
   `?p=` and a long token.
2. The site part of that link must be this menu:

   `https://chijennifer-sys.github.io/self-help-menu-frontend/?p=` followed
   by the token.

   If the link still says `chi-menu-frontend`, change only the site part to
   the address above. Leave the token as it is.
3. Open that full link on a phone.

**Check:** The page knows who they are without anyone typing. The `?p=`
token disappears from the address bar as soon as the page opens. Their own
employer and their own dates show in the personal box. The **Preview / Demo
data** strip is gone.

A wrong Student ID and a wrong date of birth must say the same thing. You
should not be able to tell which half was wrong.

---

## 8. What you do not do in this repository

These steps are real, and they are all on the backend side. Doing them here
will not help, and putting those values here will break the publish check.

- Creating the Google Sheet, the upload folder, or the Apps Script project.
- Filling in the script config, or running `checkSetup`, `checkDobColumn`,
  or `buildMenuLinks`.
- Deploying the web app (Execute as **Me**, access **Anyone**).
- Installing clasp, or pasting `CLASPRC_JSON`, `SCRIPT_ID`, or
  `DEPLOYMENT_ID` into GitHub secrets.

Those are written up for the backend repository.

Changing the words on a question is a separate, small edit: the tile lives
in `assets/content.js`. After you commit that file to `main`, wait for the
green tick, then refresh the site.

---

## 9. Leave Issues turned on

Later, one issue a day will be picked up from this repository.

1. In **Settings**, click **General**.
2. Under **Features**, leave **Issues** ticked.

New requests go under the **Issues** tab. Use **Bug report** when something
is wrong, and **Feature or wording change** when you want the menu to say
or do something new. One issue, one change. Do not put a real student name,
a Student ID, or a personal link in an issue.

**Check:** The Issues tab is visible, and **New issue** offers Bug report
and Feature or wording change.

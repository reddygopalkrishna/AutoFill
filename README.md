# Auto full

Auto full is a Chrome extension for reusing your profile on job applications and hackathon forms. It works in Chrome 123 or later.

## Install and use

1. Download the ZIP from the [latest release](https://github.com/reddygopalkrishna/AutoFill/releases/latest) and extract it into a folder.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Open **Auto full** from Chrome’s Extensions menu, enter the details you use, and click **Save profile**. Clear a saved field in the editor and save to remove its value.
5. Refresh any application tabs that were open during installation. Click into an empty field or navigate to it with **Tab** or **Shift+Tab**.

To update an existing installation, extract the new ZIP into the same folder and replace the old files. Click **Reload** on the extension card in `chrome://extensions` to keep your existing local profile.

Auto full recognizes common names, contact details, address fields, date of birth, role or designation, current company, years of experience, Skills, and GitHub, LinkedIn, and portfolio links. It combines the saved name parts for a full-name field unless you provide a full-name override. On a generic website field, choose a saved link. Date of birth requires confirmation each time, including on individual day, month, and year fields. Press **Escape** to dismiss either prompt.

## Add your own details

- Under **Work**, enter your **Skills** as a comma-separated list or on separate lines. Auto full joins separate lines with commas in single-line fields.
- Under **Custom details**, choose **Add field** for a standalone answer or **Add section** to group answers under a name such as Education. Choose **Add field** inside that section to add its answers. Press **Save profile** after adding, editing, or removing anything.
- Use the label shown on the form, such as University, Project URL, or T-shirt size. Each custom field needs a unique label across the profile. Auto full checks visible form labels and, for fields without labels, checks the placeholder and field identifiers. Custom values support standard text controls and matching native dropdown options. Multi-line custom values need a text area.

## Share or publish

Share the [latest GitHub release](https://github.com/reddygopalkrishna/AutoFill/releases/latest) for manual installation. The ZIP also has `manifest.json` at its root and can be uploaded to the Chrome Web Store. For an **Add to Chrome** link, register a developer account, upload the ZIP, complete the listing and privacy details, provide a link to the published privacy policy, select Public or Unlisted visibility, and submit for review. Auto full runs inside Chrome. [Chrome Web Store publishing guide](https://developer.chrome.com/docs/webstore/publish) · [Auto full privacy policy](https://gist.github.com/reddygopalkrishna/bb2c9775c6307d282df590614246326f)

## Form coverage and privacy

Auto full uses standard browser field metadata and common English labels. It preserves existing entries and fills the field you interact with. Native dropdowns need an empty starting choice and a matching option. Text date fields use a recognizable format from the label or placeholder when present, with `YYYY-MM-DD` as the default. Some custom widgets, unlabeled fields, and Tab movements between embedded documents may require manual entry or a click.

The profile is stored locally in this Chrome profile. Auto full makes no network requests and never submits forms. A website can read a value after it is inserted into its form. Removing the extension clears its local storage.

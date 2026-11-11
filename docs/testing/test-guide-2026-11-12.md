# Test guide: Client Hub, 12 November 2026

For Charlotte. A click through of the fixes made on 11 November, in the local harness. Nothing here touches the live site or a real client. It takes about 30 minutes.

## Before you start

1. In a terminal:

```
cd ~/efclienthub
npm run harness
```

2. Open http://localhost:5174 in your browser.
3. If a different app appears at that address, another project is using the same port. Use http://127.0.0.1:5174 instead, or stop the harness and start it on another port:

```
PORT=5180 npm run harness
```

   then open http://localhost:5180.
4. The practitioner and admin logins are in `CLAUDE.md`, under Working loop, step 3. They are not repeated here.
5. Use 2 windows: an ordinary window for the practitioner, and a private window for the client. That way both stay logged in at once.
6. The harness starts empty and forgets everything when you stop it (Control and C in the terminal). You will make 1 invented client as you go. Use any made up first name, an email ending in `@example.com`, and any password of 8 or more characters.

## The click through

Each step says what to do, then what you should see.

### Setting up a client

1. **Practitioner window: log in as the practitioner.**
   You should see the Dashboard, with "Nothing waiting on you" under Today and no clients.

2. **Open Activation codes. Type a client name, leave the email box empty, choose Neurodivergent as the client type, press Issue code.**
   You should see a new code in large type, shown once, and a row for it in the table below with the name beside it. Copy the code.

3. **Private window: open the same address, choose Create an account, and press Create account with the boxes empty.**
   You should see 3 messages, 1 under each box, and the cursor in the first box. Then fill them in and create the account.

4. **On the activation screen, look at the line under the button, then paste your code and continue.**
   You should see the practice email, consultant@sarahanticich.co.nz, in the line that starts "No code?". The code takes you to Before you start.

5. **Press Agree and continue without ticking the box. Then tick it and continue.**
   You should see "Tick the box to agree before you continue" the first time.

6. **On A few questions to start, press Finish setting up without answering.**
   You should see a message near the top saying 2 questions still need an answer, and the page should move to the first of them. Answer both and finish.

### The client's Home and a questionnaire

7. **Look at Home.**
   You should see Step 3 of 7, a To do list where only the first row has a dark Start button and the rest are outlined, pills that say To do with an empty ring (not the amber warning pill), a Next session panel and the report tracker. There should be no Your resources panel yet.

8. **Make the private window narrow, about the width of a phone.**
   You should see a small ring beside the step and title, and the first Start button without scrolling far. Nothing should need sideways scrolling.

9. **Press Start on the first questionnaire.**
   You should see a Before you start screen with the instructions, because this questionnaire's instructions are long. Press Start.

10. **On a question, press a number key, then Enter. Do this for 2 or 3 questions.**
    You should see the answer chosen and the next question appear. Back and Next question should stay at the bottom of the window on every question, and Show instructions should open the instructions again.

11. **Press Save and exit at the top right.**
    You should see the questionnaire marked In progress with a Continue button and the number of questions left.

12. **Finish all 4 questionnaires. Press Next question once without choosing an answer on the way.**
    You should see "Choose an answer to continue" when you skip. After the last questionnaire you should see "Thank you, that is everything". Press Book your feedback session: a box should give Sarah's email.

13. **Open Results, then Formulation, from the menu.**
    You should see a holding message on each, and no result of any kind.

### The practitioner's side

14. **Practitioner window: go to the Dashboard (press it in the menu to refresh).**
    You should see your client under Today with a Draft to review pill, a count beside To review, and the client's row at Book feedback, step 4 of 7.

15. **Open the client, go to the Questionnaires tab, and assign "Mood over the last 2 weeks". Then look at the client's stage on the Dashboard.**
    You should see the stage still at Book feedback. It no longer moves back to Questionnaires.

16. **Private window: go to Home, start the new questionnaire, and on the last question choose any answer other than the first. Finish it.**
    You should see it as a task in To do while the tracker still shows the first step as done.

17. **Practitioner window: go to the Dashboard.**
    You should see the client at the top of Today with a Follow up pill, an Answers to follow up pill on their row, and a Follow up button. Press it. On the draft, press Mark as followed up.
    You should stay where you were on the page, see "Marked as followed up", and see the count beside To review go down.

18. **On the same tab press Release results. Read the box, then confirm.**
    You should see a box naming the client before anything is shared, then "Results released". In the private window, Results should now show each questionnaire with the headings Areas of strength and Areas of focus, and no scores or numbers. The client's stage becomes Feedback.

19. **Open the Formulation tab. Add 1 or 2 cards in each of 3 areas, type a summary, and change "How the client sees it" a few times.**
    You should see the page stay where it is each time, with the picture redrawn. Under every picture there should be a key: Fits, Partly, Does not fit, Not answered yet.

20. **Press Release formulation.**
    You should see a box naming the client, the number of cards and the drawing, and saying a released formulation cannot be withdrawn. Press Cancel once and check nothing was shared, then release it.

21. **Private window: open Formulation. On a card near the bottom choose Fits, then choose Partly on another.**
    You should see "Saved. Sarah will see this." beside each card straight away, the page should not jump to the top, and the picture should show a tick and a half filled mark. Make the window narrow: a drawing other than the map or layers should give way to the map, with a line saying so.

22. **Practitioner window: on the Overview tab, save a next session, then add a resource. Try a link that starts with http first.**
    You should see the date and time box labelled New Zealand time. The http link should be refused with what you typed still in the boxes. With an https link, "Resource added". In the private window, Home should now show Your resources.

23. **Still on Overview, search Splose for "sample" and press Link on the first result.**
    You should be told the email does not match. Tick "Link anyway" and press Link to Splose. You should then see the Splose panel fill with invented appointments and forms. In the private window, Home should show the form once, as a row in To do.

### Privacy, admin and the phone menu

24. **Private window: open Account and privacy. Press Send correction request with the box empty, then press Request a copy of my information.**
    You should see a message under the empty box. After the request, the button should be replaced by the date you asked and the date Sarah will reply by. There should be a Contact Sarah section with the practice email.

25. **Practitioner window: log out, then log in as admin.**
    You should land on Activation codes. The table should show the last 4 characters of each code, its type, status and expiry, with no client name or email anywhere. The form should have no name or email box. Questionnaire library should open, and so should any questionnaire in it. Dashboard, Clients and To review should not be in the menu.

## Things you can only see by waiting

- **Idle log out.** Leave either window alone for 29 minutes. You should see "Are you still there?" with Stay logged in. Leave it 1 more minute and you should be logged out, with a message on the log in screen saying why.

## If something looks wrong

- Note the step number, which window, and what you saw.
- A page that says "Something went wrong" with Try again is the new error screen. It usually means the harness was stopped.
- Text you typed into a card's comment box and did not send is not sent for you. That is on purpose.

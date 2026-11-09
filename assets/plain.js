/* Short first screen for each tile.
   The full policy stays in the tile body, inside More details. */

const PLAIN = {
'When is the next online orientation': {
  lead:'Join one session before your start date.',
  steps:['Open the dates in the list below.','Use your full name and Student ID on Zoom.','Fill in the attendance form during the session.','Marked absent? Use Still need help and send the date.'],
  watch:'If you cannot join, decide before the session, not after.'
},
'My visa appointment': {
  lead:'CHI does not book the embassy appointment.',
  steps:['CHI gives you the DS-2019 and pays the SEVIS fee.','Book the embassy date in your country.','Proof of program is the DS-2019 in the portal.','Date after your start? Ask for a letter at the bottom.'],
  watch:'Do not book a flight until the visa is in your passport.'
},
'Where is my DS-2019': {
  lead:'Check your email and wt.chinet.org for your DS-2019 form.',
  steps:['Check your passport name, birth date, and both dates.','Photograph a mistake before the embassy.','A new form costs 75 dollars.','Bring the paper form. A phone photo is not enough.'],
  watch:'You need the DS-2019, the job offer, and the sponsor letter.'
},
'I need to change my start date': {
  lead:'Your employer must agree before any date can move.',
  steps:['Use the email form on this page as soon as you know.','A few days late can sometimes be arranged.','A few weeks late often cannot.','Print a correction letter and carry it with your DS-2019.'],
  watch:'Carry the DS-2019 and the new-date letter together.'
},
'Can CHI check my housing is not a scam': {
  lead:'Yes. Send the ad before you pay anything.',
  steps:['Send the address, the landlord name, and the phone number.','CHI looks at it for free. It takes about a day.','Ask for a written lease before you pay.','Already paid? Use Still need help at the bottom.'],
  watch:'CHI cannot get a deposit back after the money is gone.'
},
'How early can I arrive': {
  lead:'Land 3 to 5 days before your start date.',
  steps:['You are covered from 7 days before that date.','Earlier than that, tell CHI before you buy the ticket.','Do not start work before your start date.','Do not arrive on a weekend unless your employer agrees.'],
  watch:'Never arrive after the start date on your DS-2019.'
},
'Where do I enter my visa results': {
  lead:'Enter the result at wt.chinet.org the day you leave the embassy.',
  steps:['Open My Profile, then Visa.','Approved: add the date and a photo of the visa.','Denied: enter the date. Write Try again if you want another try.','If they keep your passport, write the slip color.'],
  watch:'Do not book a flight until the visa is in your passport.'
},
'Where do I enter my flight details': {
  lead:'Enter your flight at wt.chinet.org as soon as you book.',
  steps:['Use the last U.S. airport, not a stop on the way.','Save each flight before you add the next one.','Put the arrival time in the arrival section only.','Landing late? Stay at a hotel and travel in daylight.'],
  watch:'Some employers pick you up. Check your job offer.'
},
'Where do I verify my housing': {
  lead:'Verify housing at least 4 weeks before you arrive.',
  steps:['Do this at wt.chinet.org, even for employer housing.','Include the room or unit number.','Use this same address for SEVIS, the government record.','Living with family? They sign the Liability Release form.'],
  watch:'Without this address, CHI cannot activate SEVIS.'
},
'What airport should I fly into': {
  lead:'Fly to the airport named on your job offer.',
  steps:['No airport named? Ask before you book.','Check the ride from the airport to your housing.','A cheap flight can cost more after that ride.','Landing at night? Check the last bus first.'],
  watch:'Tell CHI before you book if you would land with no ride.'
},
'When should I contact my employer': {
  lead:'Send your arrival date before you fly.',
  steps:['Use the contact on your job offer.','Send your name, Student ID, job, and landing date.','Ask where to go, what time, and who to ask for.','No reply for two weeks? Use Still need help.'],
  watch:'Call during business hours if your first day is not confirmed.'
},
'WhatsApp groups for my employer': {
  lead:'CHI adds you to the group closer to your start.',
  steps:['Use the join link when it is on this page.','No link yet? Check again closer to your start date.','New phone number? Send it with Still need help.','Pay and documents do not go in the group.'],
  watch:'Your coordinator replies Monday to Friday, 9am to 5pm Eastern.'
},
'Where is my job description or offer': {
  lead:'Download it at wt.chinet.org, under My Job.',
  steps:['Check the employer, town, job, pay, hours, and housing.','Print one copy for the embassy.','Print one copy for your first day.','The job on paper is your proof.'],
  watch:'If the real job is different, the paper offer is your proof.'
},
'What documents do I need': {
  lead:'Carry your passport, visa, DS-2019, and job offer.',
  steps:['Also carry your sponsor letter and insurance card.','The CHI line is 1-800-432-4643, ext. 0. It is open 24/7.','Put your Student ID in every message to CHI.','Keep these papers in your hand luggage.'],
  watch:'Do not laminate or fold your DS-2019.'
},
'Where can I find my sponsor letter': {
  lead:'Download the sponsor letter from wt.chinet.org.',
  steps:['It is not your job offer.','It is not your DS-2019 form.','Social Security and some banks ask for it by name.','Print it before you fly.'],
  watch:'Print the sponsor letter before your appointment.'
},
'What should I bring': {
  lead:'Bring at least 1,500 dollars for your first 2 to 3 weeks.',
  steps:['About 500 dollars of that should be cash.','Bring medicine in the original boxes, with the prescription.','Bring an unlocked phone and a U.S. plug adapter.','Bring shoes you can wear all day.'],
  watch:'You must be 21 to buy cigarettes, vapes, or alcohol.'
},
'Can I get a second job before I arrive': {
  lead:'No. Do not set up a second job before you land.',
  steps:['Your first job always comes first.','You will not know your main hours until you start.','Fill in the form only when you have a real offer.','CHI must approve it before your first shift there.'],
  watch:'Work that CHI has not approved can put your visa at risk.'
},
'Can I start my Social Security': {
  lead:'Start the online application before you fly.',
  steps:['Do not visit the office until the activation email.','Book a time about 7 business days after you land.','Save the Online Control Number. It starts with O.','Already have a number? Apply again only if the card is lost.'],
  watch:'You can work with the receipt before the card arrives.'
},
'Where do I go on my first day': {
  lead:'Go to the address on your job offer.',
  steps:['Ask for the manager named on the offer.','Nobody expects you? Stay and call the number on the offer.','No answer? Use Still need help and send the address.','Print any correction letter and carry it with your DS-2019.'],
  watch:'Do not go home and wait.'
},
'My housing when I land': {
  lead:'Take dated photos before you move anything.',
  steps:['Wrong or unsafe? Take photos and write to the landlord.','Unsafe right now? Open the unsafe tile.','Keep the place clean if you want the deposit back.','Your employer, not CHI, handles the room day to day.'],
  watch:'CHI cannot get a deposit back for dirt or damage.'
},
'How do I get my I-94': {
  lead:'Your I-94 is free. Never pay a site that says Apply.',
  steps:['Open i94.cbp.dhs.gov.','Choose Get Most Recent I-94 only.','Download the PDF and email it to yourself.','Send it to your employer. Payroll needs the Admission Number.'],
  watch:'You need the I-94 for Social Security and for the I-9.'
},
'How do I validate my SEVIS record': {
  lead:'Enter your U.S. address at wt.chinet.org within 3 days of arrival.',
  steps:['This step is called SEVIS. CHI sends it to the government.','Use the street address and the room number.','Do not use a post office box.','Wait for the email that says your record is active.'],
  watch:'Miss this and your program can be cancelled.'
},
'How do I apply for my Social Security Number': {
  lead:'Go to the office only after the email that says your record is active.',
  steps:['Bring your passport, visa, DS-2019, I-94, and job offer.','Also bring your sponsor letter.','Ask them to mail the card to your housing.','The card usually arrives in 7 to 14 business days.'],
  watch:'You can work with the receipt before the card arrives.'
},
'How do I fill in my employment paperwork': {
  lead:'Bring your passport, DS-2019, and printed I-94.',
  steps:['On the I-9 work form, use your passport spelling.','No Social Security number yet? Ask your employer first.','You can enter 999-99-9999. Never guess a real number.','On the W-4 tax form, choose Single. In step 4(c), write Nonresident Alien.'],
  watch:'Never write Exempt on the W-4.'
},
'How do I get a US phone number': {
  lead:'Buy a prepaid SIM. You do not need a Social Security number.',
  steps:['Buy it on day one. Take your passport.','Do not sign a monthly contract.','Unlock your phone before you leave home.','Submit the new number here, and tell your employer.'],
  watch:'Do not wait until next week. This is how people reach you.'
},
'How do I open a US bank account': {
  lead:'Use a U.S. bank. Revolut and PayPal do not work for payroll.',
  steps:['Take your passport and your DS-2019.','Tell the bank you are traveling, so they do not freeze the card.','Put login codes on your email, not only on a U.S. phone.','Never accept cash wages, except tips.'],
  watch:'Never send those login codes to anyone.'
},
'How do I get to work': {
  lead:'Ask how other people in your housing get to work.',
  steps:['Check the last bus before a late shift.','Employer bus late? Tell your manager the same day.','A transport fee should match what you signed.','On a bike or scooter, wear a helmet.'],
  watch:'Unsafe driving? Write down the time and tell your manager.'
},
'I need casino fingerprinting': {
  lead:'CHI books casino fingerprinting. You cannot start until it clears.',
  steps:['You do not book it. Your employer does not book it.','Take your passport and your DS-2019.','Take your Social Security receipt if you have one.','Ask your manager what the fee is before you go.'],
  watch:'Some employers take this fee from the first paycheck. Ask your manager.'
},
'I moved to a new address': {
  lead:'Update your address at wt.chinet.org within 10 days.',
  steps:['Send the full new address, with the unit.','Send the date you moved.','SEVIS must match where you live.','This is a legal requirement.'],
  watch:'The 10 days start on the day you move.'
},
'I am not getting enough hours': {
  lead:'About 32 hours a week is the season average, not every week.',
  steps:['Keep your pay stubs during a slow week.','Fewer than 3 short weeks? Wait and keep the stubs.','Three short weeks or more? Open Still need help.','Send the stubs and a photo of the schedule.'],
  watch:'Hours often drop after a major holiday.'
},
'My pay is wrong': {
  lead:'Upload one pay stub before CHI can call the employer.',
  steps:['Say if the hours, the rate, or the deductions are wrong.','Or say you never received the pay.','Check the rate against your job offer first.','A lower first rate may be the training rate in the offer.'],
  watch:'CHI cannot call payroll without the stub.'
},
'What tax comes out of my pay': {
  lead:'Federal and state tax: yes. Social Security and Medicare tax: no.',
  steps:['See FICA, OASDI, or Medicare? Ask payroll to fix it.','Your W-2 arrives by January 31.','File Form 1040-NR at sprintax.com from February 1 to April 15.','Do not use TurboTax.'],
  watch:'Do not chase a missing W-2 before March 1.'
},
'There is Social Security or Medicare on my check': {
  lead:'You should not pay Social Security or Medicare tax.',
  steps:['Show payroll your DS-2019.','Ask them to remove FICA, OASDI, or Medicare.','They do not fix it? Open Still need help.','Have one pay stub ready.'],
  watch:'Fixing it now is faster than an IRS claim later.'
},
'I did not get my paycheck': {
  lead:'Check the address payroll has. That is the usual cause.',
  steps:['Keep a photo of the schedule and clock-in times.','Tell payroll the same week, in writing.','Wrong name? Ask them to reissue the check.','After you leave, contact your employer. Not CHI.'],
  watch:'If the bank rejects the check, email your coordinator before you try again.'
},
'My time off was refused': {
  lead:'Only your employer can approve time off. CHI cannot.',
  steps:['Ask at least 2 weeks ahead, in a message.','No is a possible answer.','Sick? Call your manager at least 2 hours before the shift.','Offer to swap the shift. Your manager must approve the swap.'],
  watch:'Missing a shift and not calling can end the job that day.'
},
'I have a problem with my manager': {
  lead:'Try your manager, then HR, before you write to CHI.',
  steps:['Direct feedback at work is normal here.','Shouting, threats, or different treatment is not.','Write the date, the words, and who else was there.','Still stuck? Open Still need help and say what you tried.'],
  watch:'Do not post about this on TikTok, Instagram, or a group chat.'
},
'I have a problem with a coworker': {
  lead:'Speak to them within two days, before you get angry.',
  steps:['Say: I feel this way when this happens.','Ask: Can we do this instead?','Still stuck? Open Still need help and say what you tried.','Shifts, tips, or money? Talk to your manager, not the coworker.'],
  watch:'Threats or unwanted touching belong on the unsafe tile.'
},
'I was sent home from a shift': {
  lead:'One bad shift is not the same as losing the job.',
  steps:['Ask in writing: am I on next week schedule?','If you are still on it, this is one bad shift.','Not on the schedule? Email CHI the same day.','You then have 10 days to be placed.'],
  watch:'Missing a shift and not calling can end the job that day.'
},
'I lost my job': {
  lead:'Do not start a new job until CHI approves it in writing.',
  steps:['You have 10 days to find a job CHI approves.','Use the email form on this page the same day.','Write the date and what they told you.','With approval, give one week of notice when you can.'],
  watch:'Never stop going to work until CHI emails an approval.'
},
'How do I get a second job approved': {
  lead:'You need written CHI approval before the first shift.',
  steps:['A verbal OK from an employer is not approval.','Use the Additional Employment form in the portal.','Both you and the new employer complete it.','Do not start until CHI emails the approval.'],
  watch:'Some jobs are never allowed. Read More details before you accept.'
},
'My casino fingerprinting': {
  lead:'CHI books casino fingerprinting. You do not book it.',
  steps:['Booking steps are on I need casino fingerprinting.','Off the schedule while you wait? Write down each free week.','Past two weeks? Use the email button and send that list.','A second casino needs its own fingerprinting.'],
  watch:'Lost the badge? Tell your employer the same day.'
},
'Can I change to a different employer': {
  lead:'Work at least 30 days first. CHI must approve the new job.',
  steps:['Do not walk out of your job.','Never stop work until CHI emails the approval.','Give at least one week of written notice.','Open the job change checklist.'],
  watch:'Leave with nothing approved, and you have 10 days to be placed.'
},
'Can I make my second job my main job': {
  lead:'This is a swap, not a new second job.',
  steps:['Your second employer is already approved.','Give notice to your current main employer.','Get written proof the second job will give full hours.','CHI does the SEVIS swap.'],
  watch:'Filing this as a new second job sends it the wrong way.'
},
'Something else about my job': {
  lead:'Write what happened, what you tried, and what you want.',
  steps:['Schedule, pay, and hours: ask your employer or HR.','Rent, keys, and house rules: ask the landlord.','SEVIS, a second job, or travel: use the form on that tile.','Insurance card or a claim: use the Student Zone.'],
  watch:'If you are in danger, open the unsafe tile.'
},
'I was in an accident': {
  lead:'Get medical care first. Then email CHI.',
  steps:['See a doctor or urgent care if you are hurt.','Call IMG at 1-855-731-9445. The number is on your card.','Email CHI with the form on this page.','Keep photos and any bill.'],
  watch:'If you are not safe, call 911.'
},
'I am sick or I am hurt': {
  lead:'Not an emergency? Do not start at the emergency room.',
  steps:['Start with free Teladoc in the USA.','Call 1-800-835-2362. ZIP code 46208.','A walk-in clinic is 0 dollars. Urgent care is 25.','Do not pay a bill yourself. Send it through the Student Zone.'],
  watch:'A real emergency: call 911. An ER starts at 350 dollars.'
},
'I want to see a doctor': {
  lead:'Start with free Teladoc, after your cover has started.',
  steps:['Use it only in the USA. ZIP code 46208.','Call 1-800-835-2362. Do not enter a promo code.','In person, prefer a walk-in clinic at 0 dollars.','Pay the pharmacy, keep the receipt, and file a claim.'],
  watch:'Mental health is not on Teladoc. Use DialCare for that.'
},
'I have a toothache': {
  lead:'A normal toothache is not covered. You pay.',
  steps:['Do not use the emergency room for a normal toothache.','Call two or three offices and ask the price first.','A tooth broken in an accident may be covered.','Not sure? Call IMG at 1-855-731-9445 before you book.'],
  watch:'See a dentist at home before you fly.'
},
'Where do I find my insurance card': {
  lead:'Download the card from the Envisage Student Zone.',
  steps:['Save it on your phone and print one copy.','The plan is UnitedHealthcare Options PPO, run by IMG.','Show the card at every visit.','Cannot log in? Open Still need help and say what you tried.'],
  watch:'Walk-in is 0 dollars. Urgent care is 25. The ER adds 350.'
},
'I feel unsafe or I am being harassed': {
  lead:'In danger now? Call 911. Then call 1-800-432-4643, ext. 0.',
  steps:['That CHI line is open 24/7.','Then use the email button on this page.','You do not need perfect English or proof.','Threats, unwanted touching, or being blocked: write to CHI now.'],
  watch:'Keep your passport and DS-2019 locked at home, not at work.'
},
'I am struggling or homesick': {
  lead:'Some people find weeks 3 and 4 the hardest. It can ease in about 10 days.',
  steps:['Counseling in your plan is free.','Register at dialcare.com/verify.','Or call DialCare at 1-855-335-2255.','This is not for immediate danger.'],
  watch:'In immediate danger, call 911, then the CHI line.'
},
'I lost my passport or another document': {
  lead:'File a police report, then email CHI.',
  steps:['File a police report and keep the number.','Contact your embassy for a new passport.','Email CHI with the form on this page.','A new DS-2019 costs 75 dollars.'],
  watch:'A visa can only be replaced outside the United States.'
},
'I need a letter or a document from CHI': {
  lead:'Many letters are already in your portal. Download those first.',
  steps:['Check wt.chinet.org before you ask.','Sponsor letter and job offer are separate downloads.','Still missing? Open Still need help.','Say which letter and the date you need it.'],
  watch:'Do not wait until the day of an appointment.'
},
'I cannot get into my CHI portal': {
  lead:'Reset the password at wt.chinet.org. Never send a password to anyone.',
  steps:['Check spam for the reset email.','Your Student ID is on the portal home page.','Your sponsor is CHI. The sponsor letter is in the portal.','Still locked out? Open Still need help and say what you tried.'],
  watch:'Never send a login code to anyone, including CHI staff.'
},
'My Social Security card has not come': {
  lead:'The card usually arrives in 7 to 14 business days.',
  steps:['You can work with the receipt before the card arrives.','Give the number to every employer, including a second job.','After 14 business days, ask the Social Security office.','Ask them to mail the card to your housing, not your employer.'],
  watch:'CHI does not take your mail.'
},
'Address verification for the bank': {
  lead:'The proof of address is already in your CHI portal.',
  steps:['Download it yourself.','Check that the address is right.','Take it with your passport and DS-2019.','Wrong address? Fix it with CHI before you go to the bank.'],
  watch:'A wrong address here can also be wrong in SEVIS.'
},
'Can I travel inside or outside the United States': {
  lead:'Travel inside the U.S. is fine. Leaving needs a travel signature.',
  steps:['Entries M means you can enter more than once. S means once.','Your return flight must land before your program end date.','Get a written yes from your employer.','Request a travel signature 2 weeks ahead.'],
  watch:'Puerto Rico needs no signature. A cruise that stops abroad does.'
},
'I am being evicted': {
  lead:'Do not sign anything yet. Email CHI the same day.',
  steps:['Photograph the notice exactly as you received it.','Ask what you owe, and for which dates.','Check that amount against your pay stubs.','Tell your roommates the same day.'],
  watch:'Keep going to work. The job is what pays the rent.'
},
'There is a problem at my housing': {
  lead:'Take dated photos. Write to the landlord first.',
  steps:['CHI does not negotiate your rent or your deposit.','Pay rent on the due date, even in a slow week.','Moving? Update the portal address within 10 days.','Told to leave? Use the eviction tile.'],
  watch:'A back-rent warning can take you off the schedule.'
},
'I want to go home early': {
  lead:'Finishing work early is not the same as leaving early.',
  steps:['Tell your employer in writing, one week ahead.','Leaving the U.S.? Send one shorten request.','Date change? Email your coordinator. Do not send it twice.','After you fly, send a photo of your boarding pass.'],
  watch:'Grace time starts on your last day of work. You cannot work then.'
},
'When do I have to leave the United States': {
  lead:'You cannot extend your J-1 or your DS-2019.',
  steps:['The grace period starts on your last day of work.','You may stay up to 30 days after that day.','You cannot work in the grace period.','Leave the country, and you cannot come back on this visa.'],
  watch:'Insurance ends on your program end date, not when the grace period ends.'
},
'Can I travel before I go home': {
  lead:'A trip outside the U.S. must bring you back before your program end date.',
  steps:['Use the other travel tile for the signature steps.','Get a written yes from your employer.','Request a travel signature 2 weeks ahead.','After your last work day, travel inside the U.S. only.'],
  watch:'Leave during the grace period and you cannot come back.'
},
'How do I extend my insurance for my travel period': {
  lead:'Cover ends on your program end date. The grace period does not extend it.',
  steps:['Ask before that date.','The fee is 50 dollars.','Pay by card before your program end date.','Use the email form on this page. It goes to CHI.'],
  watch:'After the cover stops, it usually cannot be added back.'
},
'How do I get my final paycheck': {
  lead:'Ask payroll before your last shift how the last pay will reach you.',
  steps:['If it arrives after you leave, contact your employer.','CHI does not receive it, mail it, or deposit it.','Before you leave, update your address with your employer and your bank.','Keep the bank open through tax filing.'],
  watch:'CHI does not take your mail.'
},
'Should I close my US bank account': {
  lead:'Not yet. Keep it open until the final pay and any tax refund arrive.',
  steps:['Update your address with the bank before you leave.','Move login codes to your email.','Ask how to close the account from home.','Leave a small balance for fees.'],
  watch:'CHI does not take your mail. Never leave your login with a roommate.'
},
'How do I claim my tax overages back': {
  lead:'File Form 1040-NR at sprintax.com. Do not use TurboTax.',
  steps:['File from February 1 to April 15.','Your W-2 should arrive by January 31.','Give your employer an address that works in January.','Social Security tax taken by mistake: ask payroll first.'],
  watch:'CHI staff are not tax advisors and cannot fill in the forms.'
},
'Can I come back next year': {
  lead:'Yes, if you are still a full-time student. CHI has a 3-year maximum.',
  steps:['Finish this season with no open problems.','Do not ask the employer for your own offer.','Sign a letter of intent for the full season.','Then use the email form on this page.'],
  watch:'CHI will not issue a DS-2019 for a job you arranged yourself.'
},
'Help me find housing': {
  lead:'Choose a place you can get to work from. Send it before you pay.',
  steps:['Look in your employer WhatsApp group first.','Check the commute before you book.','Verify the address at least 4 weeks before you arrive.','Bring at least 1,500 dollars for the first weeks.'],
  watch:'Do not wire a large sum before you see the place.'
},
'When do I start working': {
  lead:'The start date is the first day you may work, not a promised shift.',
  steps:['Validate SEVIS within 3 days of arriving.','Finish every task in the employer app.','No Social Security number? Ask first. You may use 999-99-9999.','No schedule after five work days? Email your manager, then CHI.'],
  watch:'Do not guess a Social Security number that is not yours.'
},
'Can I change my position or department': {
  lead:'You can ask. The employer decides.',
  steps:['Ask your manager which department or store is open.','This is not a new employer.','A new employer still needs 30 days and CHI approval.','Still stuck? Open Still need help and say what you tried.'],
  watch:'Do not stop working while you wait for an answer.'
},
'My monthly evaluation': {
  lead:'Complete the monthly evaluation at wt.chinet.org, even after you are home.',
  steps:['A second job needs one too.','Finish it to stay in good standing.','It also matters if you want to come back next year.','Forgot? Open the portal and submit it now.'],
  watch:'Skipping it can hurt a return next season.'
},
'Who do I contact for help': {
  lead:'Employer for the job. Landlord for the room. CHI for the program.',
  steps:['Schedule, pay, and training: employer or HR.','Rent, keys, and repairs: the landlord.','SEVIS, a second job, or travel: use the form on that tile.','Insurance card or a claim: Envisage Student Zone, or IMG at 1-855-731-9445.'],
  watch:'If you are in danger, open the unsafe tile.'
}
};

T.forEach(function(t){
  const row = PLAIN[t.q];
  if(!row || !row.lead) throw new Error('No plain screen for ' + t.q);
  t.plain = row;
});

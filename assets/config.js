/* CHI participant menu — configuration.
   ENDPOINT is the deployed Apps Script web app /exec URL. Empty runs on DEMO. */

const ENDPOINT = '';

/* ---------- demo roster. Fictional records for testing only.
   In production this is replaced by one lookup call, see the wiring view. ---------- */
const DEMO = [
 {sid:'52341', tok:'d3f19a7c4b8e2610a95f7d3c81', dob:'2004-03-11', last:'Ionescu', first:'Andrei', name:'Andrei Ionescu', agency:'AEX', country:'Romania',
  employer:'Aramark', location:'Ocean City, NJ', job:'Food Service Worker',
  dsStart:'2026-06-01', dsEnd:'2026-09-15', arrival:'2026-05-28', email:'demo1@example.com', hasSSN:'Yes', season:'Summer 2026'},
 {sid:'53880', tok:'7b2e94c05af31d68e27a4b9f30', dob:'2003-07-29', last:'Ristic', first:'Marta', name:'Marta Ristic', agency:'EXPB', country:'Bosnia and Herzegovina',
  employer:'ACME Wildwood 821', location:'Wildwood, NJ', job:'Cashier',
  dsStart:'2026-05-20', dsEnd:'2026-09-01', arrival:'2026-05-05', email:'demo2@example.com', hasSSN:'No', season:'Summer 2026'},
 {sid:'59410', tok:'a15c8d37e9b04f2617c3d85a6b', dob:'2005-01-04', last:'Wongsa', first:'Nira', name:'Nira Wongsa', agency:'STA', country:'Thailand',
  employer:'Steel Pier', location:'Atlantic City, NJ', job:'Ride Operator',
  dsStart:'2026-06-10', dsEnd:'2026-09-20', arrival:'2026-06-08', email:'demo3@example.com', hasSSN:'No', season:'Summer 2026'},
 {sid:'60915', tok:'e84a2f61c07d93b5482e1a7c0d', dob:'2002-11-18', last:'Petrov', first:'Ivan', name:'Ivan Petrov', agency:'EXPB', country:'Bosnia and Herzegovina',
  employer:'Hard Rock Cafe', location:'Atlantic City, NJ', job:'Server',
  dsStart:'2026-05-25', dsEnd:'2026-09-10', arrival:'2026-05-23', email:'demo5@example.com', hasSSN:'Yes', season:'Summer 2026'},
 {sid:'61200', tok:'2c7d05e93a16b8f4d70c92e5a1', dob:'2004-09-02', last:'Petrov', first:'Ivan', name:'Ivan Petrov', agency:'AIM', country:'Bulgaria',
  employer:'Island Waterpark at Showboat', location:'Atlantic City, NJ', job:'Lifeguard',
  dsStart:'2026-12-01', dsEnd:'2027-03-15', arrival:'2026-11-26', email:'demo4@example.com', hasSSN:'No', season:'Winter 2026-27'}
];


/* Agency codes are internal. The page holds the name so a participant never sees a code. */

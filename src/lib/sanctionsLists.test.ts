// Self-check — run directly with `node src/lib/sanctionsLists.test.ts`. Small fixtures in each list's real format.
import assert from 'node:assert/strict'
import { parseCsv, parseEu, parseOfac, parseUk, parseUn } from './sanctionsLists.ts'
import { autoReview, findCandidates, nameScore, normalised } from './nameMatch.ts'

assert.deepEqual(parseCsv('a,"b, ""c""",d\r\n1,2,3'), [['a', 'b, "c"', 'd'], ['1', '2', '3']])
assert.deepEqual(parseCsv('x;"y\nz"', ';'), [['x', 'y\nz']])

const ofac = parseOfac(
  '36,"AEROCARIBBEAN AIRLINES",-0- ,"CUBA",-0- \n100,"BELLO, Musa","individual","SDGT",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"DOB 1970"\n200,"SEA STAR","vessel","X"',
  '36,12,"aka","AERO-CARIBBEAN",-0- ', '36,25,-0- ,"Havana","Cuba",-0- \n100,1,-0- ,"Kano","Nigeria",-0- ')
assert.deepEqual(ofac.map((e) => [e.id, e.type, e.names, e.countries]), [['36', 'organisation', ['AEROCARIBBEAN AIRLINES', 'AERO-CARIBBEAN'], ['cuba']], ['100', 'person', ['BELLO, Musa'], ['nigeria']]], 'vessels skipped')
assert.deepEqual(ofac[1].birthYears, [1970])

const uk = parseUk('Report Date: 03-Nov-2026\nLast Updated,Unique ID,Name 6,Name 1,Name 2,Name 3,Name 4,Name 5,Designation Type,Address Country,Nationality(/ies),Country of birth,D.O.B,National Identifier number,Passport number,Business registration number (s)\n'
  + '01/01/2026,UK1,Okafor,Chidi,,,,,Individual,,Nigeria,,dd/mm/1980,,A123,\n01/01/2026,UK1,Okafor,Chidi Emeka,,,,,Individual,,,,,,,\n01/01/2026,UK2,Riverline Trading Ltd,,,,,,Entity,Kenya,,,,,,C-99/2020\n01/01/2026,UK3,Ocean Glory,,,,,,Ship,,,,,,,')
assert.deepEqual(uk.map((e) => [e.id, e.type, e.names.length]), [['UK1', 'person', 2], ['UK2', 'organisation', 1]], 'grouped by Unique ID; ships skipped')
assert.deepEqual([uk[0].birthYears, uk[0].countries, uk[0].ids, uk[1].ids], [[1980], ['nigeria'], ['A123'], ['C-99/2020']])

const eu = parseEu('fileGenerationDate;Entity_LogicalId;Entity_SubjectType;Entity_SubjectType_ClassificationCode;NameAlias_WholeName;Address_CountryDescription;BirthDate_Year\nx;13;P;person;Ahmed Musa;;1975\nx;13;P;person;Ahmad Musa;SUDAN;\nx;14;E;enterprise;Bright Horizon Holdings;UAE;')
assert.deepEqual(eu.map((e) => [e.id, e.type, e.names, e.countries, e.birthYears]), [['13', 'person', ['Ahmed Musa', 'Ahmad Musa'], ['sudan'], [1975]], ['14', 'organisation', ['Bright Horizon Holdings'], ['uae'], []]])

const un = parseUn('<CONSOLIDATED_LIST><INDIVIDUALS><INDIVIDUAL><REFERENCE_NUMBER>QDi.1</REFERENCE_NUMBER><FIRST_NAME>ABU</FIRST_NAME><SECOND_NAME>HAMZA</SECOND_NAME><NATIONALITY><VALUE>Somalia</VALUE></NATIONALITY><INDIVIDUAL_ALIAS><ALIAS_NAME>Abu Hamsa</ALIAS_NAME></INDIVIDUAL_ALIAS><INDIVIDUAL_DATE_OF_BIRTH><YEAR>1968</YEAR></INDIVIDUAL_DATE_OF_BIRTH></INDIVIDUAL></INDIVIDUALS><ENTITIES><ENTITY><REFERENCE_NUMBER>QDe.2</REFERENCE_NUMBER><FIRST_NAME>AL-HARAMAIN &amp; PARTNERS</FIRST_NAME><ENTITY_ADDRESS><COUNTRY>Kenya</COUNTRY></ENTITY_ADDRESS></ENTITY></ENTITIES></CONSOLIDATED_LIST>')
assert.deepEqual(un.map((e) => [e.id, e.type, e.names, e.countries, e.birthYears]), [['QDi.1', 'person', ['ABU HAMZA', 'Abu Hamsa'], ['somalia'], [1968]], ['QDe.2', 'organisation', ['AL-HARAMAIN & PARTNERS'], ['kenya'], []]])

// Matching: word order, legal forms and accents do not matter.
assert.equal(normalised('BELLO, Musa'), normalised('Musa Bello'))
assert.equal(nameScore('Riverline Trading Ltd', 'RIVERLINE TRADING LIMITED'), 1)
assert.equal(nameScore('Riverbend Trust', 'Riverline Trading'), 0)
assert.equal(nameScore('Amina Okoro', 'Amina Okoro Bello'), 0.67)
const all = [...ofac, ...uk, ...eu, ...un]
assert.deepEqual(findCandidates('Musa Bello', all).map((c) => [c.entry.source, c.entry.id, c.score]), [['ofac', '100', 1]])
assert.deepEqual(findCandidates('Riverbend Community Trust', all), [])

// Automatic review rules.
const cand = (name: string) => findCandidates(name, all)[0]
assert.equal(autoReview({ name: 'Musa Bello', type: 'organisation' }, cand('Musa Bello')).decision, 'false_positive', 'type mismatch')
assert.match(autoReview({ name: 'Musa Bello', type: 'person', country: 'ke' }, cand('Musa Bello')).rule, /Different country/)
assert.deepEqual(autoReview({ name: 'Musa Bello', type: 'person', country: 'ng' }, cand('Musa Bello')), { decision: 'confirmed_match', rule: 'Exact name, same type and same country' })
assert.equal(autoReview({ name: 'Musa Bello', type: 'person', birthYear: 1990 }, cand('Musa Bello')).decision, 'false_positive', 'birth years far apart')
assert.equal(autoReview({ name: 'Musa Bello', type: 'person' }, cand('Musa Bello')).decision, 'needs_review', 'name alone never confirms')
assert.deepEqual(autoReview({ name: 'Riverline Trading', type: 'organisation', registrationNumber: 'c 99 2020' }, cand('Riverline Trading')), { decision: 'confirmed_match', rule: 'Identifier matches exactly' })
assert.equal(autoReview({ name: 'Chidi Okafor', type: 'person', birthYear: 1981, country: 'ng' }, cand('Chidi Okafor')).decision, 'confirmed_match', 'birth year within a year')

console.log('sanctionsLists.test.ts: all assertions passed')

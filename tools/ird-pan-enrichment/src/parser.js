const SOURCE_URL = 'https://ird.gov.np/pan-search/';
const ACCOUNT_TYPES = { '00':'VAT','10':'Income Tax','11':'WPAN','20':'Excise','30':'Personal PAN','40':'Health Tax','50':'Education Tax','60':'DST','61':'Non-Resident Airlines' };
const ACCOUNT_STATUSES = { A:'Active',C:'Closed',D:'Deactive' };
const clean = value => value === null || value === undefined ? '' : String(value).trim();
const unique = values => [...new Set(values.filter(Boolean))];
const normalizeName = value => clean(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

function parseIrdResponse(response, expectedPan, contractorName, queriedAt) {
  const base = { contractor_name:contractorName,pan:expectedPan,taxpayer_name:'',taxpayer_name_ne:'',business_name:'',business_name_ne:'',taxpayer_type:'',registration_status:'',tax_office:'',business_address:'',registration_date:'',vat_status:'',queried_at:queriedAt,source_url:SOURCE_URL,query_status:'',review_reason:'',review_action:'' };
  if (!/^\d{9}$/.test(expectedPan)) return { ...base, query_status:'INVALID_INPUT', review_reason:'PAN_MUST_BE_9_DIGITS' };
  if (!response || response.error || response.code === 0 || response === 0) return { ...base, query_status:'NOT_FOUND', review_reason:'IRD_RETURNED_NO_VALID_RECORD' };
  const data=response.data||{}; const pan=(data.panDetails&&data.panDetails[0])||{}; const registrations=data.panRegistrationDetail||[]; const businesses=data.businessDetail||[];
  if (!clean(pan.pan)) return { ...base,query_status:'NOT_FOUND',review_reason:'IRD_RETURNED_NO_PAN_DETAIL' };
  if (clean(pan.pan)!==expectedPan) return { ...base,query_status:'REQUEST_FAILED',review_reason:'RESPONSE_PAN_MISMATCH' };
  const types=unique(registrations.map(item=>ACCOUNT_TYPES[clean(item.acctType)]||clean(item.acctType)));
  const statuses=unique(registrations.map(item=>`${ACCOUNT_TYPES[clean(item.acctType)]||clean(item.acctType)}: ${ACCOUNT_STATUSES[clean(item.accountStatus)]||clean(item.accountStatus)}`));
  const vat=registrations.find(item=>clean(item.acctType)==='00');
  const personal=registrations.length>0&&registrations.every(item=>clean(item.acctType)==='30');
  const returnedName=clean(pan.trade_Name_Eng); const expected=normalizeName(contractorName); const returned=normalizeName(returnedName);
  const malformedExpected=!expected||/^\d+$/.test(expected)||expected.replace(/[?0\s]/g,'').length<3;
  const nameMismatch=!malformedExpected&&expected!==returned&&!expected.includes(returned)&&!returned.includes(expected);
  return { ...base, taxpayer_name:returnedName,taxpayer_name_ne:clean(pan.trade_Name_Nep),business_name:unique(businesses.map(item=>clean(item.trade_Name_Eng))).join(' | '),business_name_ne:unique(businesses.map(item=>clean(item.trade_Name_Nep))).join(' | '),taxpayer_type:types.join(' | '),registration_status:statuses.join(' | '),tax_office:clean(pan.office_Name),business_address:[clean(pan.vdc_Town),clean(pan.street_Name),clean(pan.ward_No)&&`Ward ${clean(pan.ward_No)}`].filter(Boolean).join(', '),registration_date:clean(pan.eff_Reg_Date)||unique(registrations.map(item=>clean(item.registrationDate))).join(' | '),vat_status:vat?(ACCOUNT_STATUSES[clean(vat.accountStatus)]||clean(vat.accountStatus)):'Not registered',query_status:'FOUND',review_reason:personal?'PERSONAL_TAXPAYER_REVIEW':nameMismatch?'NAME_MISMATCH_REVIEW':'READY_FOR_REVIEW' };
}

module.exports={parseIrdResponse,SOURCE_URL};

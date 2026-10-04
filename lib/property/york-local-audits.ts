/** Public catalogue metadata only; these audits do not authorize property-record queries. */
export const YORK_LOCAL_AUDITS = {
  Vaughan: {
    reviewedAt:"2026-10-03",status:"municipal_reuse_unresolved",catalogueScope:"37 public Feature Service items owned by planning.gis_vaughan; this is not a complete City catalogue audit.",
    officialMapUrl:"https://www.vaughan.ca/business/online-maps",
    termsUrl:"https://maps.vaughan.ca/planit/termsofuse.aspx",
    termsResult:"The old terms URL redirects to official PLANit. PLANit publishes warranty/risk terms without an explicit commercial redistribution grant; core dataset licence fields are blank or null.",
    policyVerification:"Official comprehensive-zoning and Building Standards guidance give different descriptions of 001-2021/1-88 applicability. Current legal instruments, appeal outcomes and parcel-specific transitions remain unverified.",
    sources:[
      {layer:"addresses",item:"be5892d3b66b403cb8a98c5b64f724e4"},
      {layer:"permits",item:"47f4035ac1834246b07e6cd2396ce62e"},
      {layer:"planningApplications",item:"5e026ba0d53d49d99c4382d5e704f26e"},
      {layer:"closedPlanningApplications",item:"f9fe1cfac3c7459ab66329d5012de9aa"},
      {layer:"zoning",item:"6cd0a358ef5d4c34819cd00c334543c3"},
      {layer:"heritage",item:"b1d02e60e5b14020b175a712aa528d63"},
      {layer:"heritageDistrict",item:"1b72a456d308435983240d907541503b"},
      {layer:"officialPlan",item:"50ae79822b3549ba9f2b3863ce1a5d88"}
    ].map(f=>({...f,status:"withheld",records:null,reason:"Core municipal dataset reuse grant is unverified; no property records are queried."}))
  },
  "Richmond Hill": {
    reviewedAt:"2026-10-03",status:"municipal_reuse_unresolved",catalogueScope:"56 public Feature Service items in City ArcGIS organisation cu2HFDk7AqvG7e31; this is not a complete City catalogue audit.",
    officialMapUrl:"https://www.richmondhill.ca/en/learn-more/rh-maps.aspx",
    planningUrl:"https://www.richmondhill.ca/en/learn-more/Planning-Development.aspx",
    termsResult:"The official active-application map links a dataset with null licence terms; heritage mapping publishes convenience/warranty wording without an explicit redistribution grant. Quarterly planning summaries are identified on the City page but not connected as a licensed full-history adapter.",
    sources:[
      {layer:"planningApplications",item:"e191eaaf961142d9a0f36e4e6cdc6c64"},
      {layer:"currentPlanningApplications",item:"d7b1f0588abe4d8db14a847e1a65a404"},
      {layer:"zoning",item:"6c0180804c904f04817a34a0f492f392"},
      {layer:"zoningAppeals",item:"abc77b1b3a36400daebe497986a985e1"},
      {layer:"heritage",item:"efaa28a7ee4d435497875543704d19be"}
    ].map(f=>({...f,status:"withheld",records:null,reason:"Core municipal dataset reuse grant is unverified; no property records are queried."}))
  }
};

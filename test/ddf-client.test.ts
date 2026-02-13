import nock from 'nock';
import { DDFClient } from '../src/ddf-client';

describe('DDFClient', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
  });

  it('logs in successfully when RETS reply code is 0', async () => {
    nock('https://replication.crea.ca')
      .get('/Login.ashx')
      .reply(200, '<?xml version="1.0"?><RETS ReplyCode="0" ReplyText="Success" RETS-Version="RETS/1.7.2"/>', {
        'Set-Cookie': ['session=abc123'],
      });

    const client = new DDFClient({ username: 'user', password: 'pass' }, ['https://replication.crea.ca/Login.ashx']);
    const ok = await client.login();
    expect(ok).toBe(true);

    nock('https://replication.crea.ca')
      .get('/Logout.ashx')
      .reply(200, '<?xml version="1.0"?><RETS ReplyCode="0" ReplyText="Success"/>');
    await client.logout();
  });

  it('returns false for invalid credentials reply', async () => {
    nock('https://replication.crea.ca')
      .get('/Login.ashx')
      .reply(401, '<?xml version="1.0"?><RETS ReplyCode="20037" ReplyText="Invalid login"/>');

    const client = new DDFClient({ username: 'bad', password: 'bad' }, ['https://replication.crea.ca/Login.ashx']);
    const ok = await client.login();
    expect(ok).toBe(false);
  });

  it('parses compact listing search results', async () => {
    nock('https://replication.crea.ca')
      .get('/Login.ashx')
      .reply(200, '<?xml version="1.0"?><RETS ReplyCode="0" ReplyText="Success" RETS-Version="RETS/1.7.2"/>', {
        'Set-Cookie': ['session=abc123'],
      });

    const compactXml = `<?xml version="1.0"?>
      <RETS ReplyCode="0" ReplyText="Success">
        <COUNT Records="1" />
        <DATA>
          <COLUMNS>\tListingKey\tMlsNumber\tStandardStatus\tListPrice\tStreetAddress\tCity\tStateOrProvince\tPostalCode\tBedroomsTotal\tBathroomsTotalInteger\tLivingArea\tPropertyType\tPropertySubType\tListingContractDate\tModificationTimestamp\t</COLUMNS>
          <DATA>\tL123\tMLS123\tActive\t500000\t123 Main\tToronto\tON\tA1A1A1\t2\t2\t900\tResidential\tCondo\t2025-01-01\t2025-01-02T10:00:00Z\t</DATA>
        </DATA>
      </RETS>`;

    nock('https://replication.crea.ca').post('/Search.ashx').query(true).reply(200, compactXml);

    const client = new DDFClient({ username: 'user', password: 'pass' }, ['https://replication.crea.ca/Login.ashx']);
    await client.login();

    const listings = await client.searchListings({ status: ['Active'], limit: 1 });
    expect(listings).toHaveLength(1);
    expect(listings[0]?.MlsNumber).toBe('MLS123');

    nock('https://replication.crea.ca')
      .get('/Logout.ashx')
      .reply(200, '<?xml version="1.0"?><RETS ReplyCode="0" ReplyText="Success"/>');
    await client.logout();
  });
});

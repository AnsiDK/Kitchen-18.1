const test = require('node:test');
const assert = require('node:assert');
const server = require('./server');

test('host creates, players guess once, host reveals', async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/api/sessions`;
  const call = async (method, url, body, key) => {
    const res = await fetch(url, { method, headers: key ? { 'x-host-key': key } : {}, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  try {
    const { data: { code, hostKey } } = await call('POST', base, { question: 'Jellybeans?', target: 100 });
    assert.match(code, /^[A-Z]{4}$/);

    assert.deepStrictEqual((await call('GET', `${base}/${code}`)).data, { question: 'Jellybeans?', closed: false }, 'players must not see the answer');
    assert.equal((await call('POST', `${base}/${code}/guesses`, { name: 'Ana', guess: 90 })).status, 201);
    assert.equal((await call('POST', `${base}/${code}/guesses`, { name: 'ana', guess: 99 })).status, 409, 'one guess per name');
    assert.equal((await call('POST', `${base}/${code}/guesses`, { name: 'Bo', guess: 'x' })).status, 400);
    assert.equal((await call('POST', `${base}/${code}/close`)).status, 403, 'only host closes');

    assert.equal((await call('POST', `${base}/${code}/close`, null, hostKey)).status, 200);
    assert.equal((await call('POST', `${base}/${code}/guesses`, { name: 'Bo', guess: 1 })).status, 409, 'closed round');
    const { data } = await call('GET', `${base}/${code}`, null, hostKey);
    assert.deepStrictEqual(data, { question: 'Jellybeans?', target: 100, closed: true, guesses: [{ name: 'Ana', guess: 90 }] });
  } finally {
    server.close();
  }
});

export function createD1Stub(responses = []) {
  const calls = [];
  const queue = [...responses];
  const prepare = sql => {
    let values = [];
    const statement = {
      bind: (...next) => { values = next; return statement; },
      first: async () => execute('first'),
      all: async () => execute('all'),
      run: async () => execute('run'),
    };
    const execute = operation => {
      calls.push({ sql, values, operation });
      return queue.length ? queue.shift() : operation === 'all' ? { results: [] } : null;
    };
    return statement;
  };
  return {
    calls,
    db: { prepare, batch: async statements => Promise.all(statements.map(statement => statement.run())) },
  };
}

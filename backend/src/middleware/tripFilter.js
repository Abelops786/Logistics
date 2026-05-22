// Tax audit masking: admin role never sees cash trips
function buildTripWhereClause(role, existingConditions = []) {
  const conditions = [...existingConditions];
  if (role === 'admin') {
    conditions.push("payment_type = 'bank'");
  }
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

function stripCashFields(role, trip) {
  if (role !== 'admin') return trip;
  const safe = { ...trip };
  delete safe.payment_type;
  return safe;
}

function stripCashFieldsArray(role, trips) {
  return trips.map((t) => stripCashFields(role, t));
}

module.exports = { buildTripWhereClause, stripCashFields, stripCashFieldsArray };

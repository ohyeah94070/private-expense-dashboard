const SourceRanges = (() => {
  const tabs = ["Stmt", "Budget", "Future One-off Plans", "Income & Transfers", "Large exp.", "Ex. Rate", "FX Feed"];
  function columnName(count) {
    if (!Number.isInteger(count) || count < 1) throw new Error("Invalid sheet width.");
    let result = "";
    while (count) { count--; result = String.fromCharCode(65 + count % 26) + result; count = Math.floor(count / 26); }
    return result;
  }
  function range(name, count) {
    return "'" + name.replaceAll("'", "''") + "'!A:" + columnName(count);
  }
  return {tabs, range};
})();
if (typeof module !== "undefined") module.exports = SourceRanges;

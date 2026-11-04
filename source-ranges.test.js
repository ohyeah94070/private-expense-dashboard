const assert = require("node:assert/strict");
const SourceRanges = require("./source-ranges.js");
assert.equal(SourceRanges.range("Future One-off Plans",8),"'Future One-off Plans'!A:H");
assert.equal(SourceRanges.range("Large exp.",5),"'Large exp.'!A:E");
assert.equal(SourceRanges.range("O'Brien",27),"'O''Brien'!A:AA");
assert(SourceRanges.tabs.includes("Future One-off Plans"));
assert(!SourceRanges.tabs.includes("Settings"));
console.log("Quoted, width-aware Sheet ranges passed");

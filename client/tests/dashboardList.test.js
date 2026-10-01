import assert from "node:assert/strict";
import test from "node:test";
import { filterDashboardRushees, shuffleArray } from "../src/features/dashboard/list.js";

const rushees = [
    { name: "Zoe Beta", major: "CS", class: "Junior", gtid: "123456789" },
    { name: "Ada Alpha", major: "Math", class: "Senior", gtid: "987654321" },
    { name: "Bea Gamma", major: "CS", class: "Senior", gtid: "111111111" },
];

const options = (overrides = {}) => ({
    selectedMajor: "All",
    selectedClass: "All",
    query: "",
    selectedSort: "none",
    ...overrides,
});

test("dashboard filtering applies major and class before exact GTID lookup", () => {
    const unusedFuse = { search: () => { throw new Error("exact IDs must skip fuzzy search"); } };

    assert.deepEqual(filterDashboardRushees(rushees, options({
        selectedMajor: "CS", selectedClass: "Senior",
    }), unusedFuse), [rushees[2]]);
    assert.deepEqual(filterDashboardRushees(rushees, options({
        selectedMajor: "CS", query: " 123456789 ",
    }), unusedFuse), [rushees[0]]);
    assert.deepEqual(filterDashboardRushees(rushees, options({
        selectedMajor: "Math", query: "123456789",
    }), unusedFuse), []);
});

test("fuzzy queries retain the original full-list search and sorting order", () => {
    const calls = [];
    const fuse = { search(query) {
        calls.push(query);
        return [{ item: rushees[0] }, { item: rushees[1] }];
    } };

    assert.deepEqual(filterDashboardRushees(rushees, options({
        selectedMajor: "CS", selectedSort: "firstName", query: "ada",
    }), fuse), [rushees[1], rushees[0]]);
    assert.deepEqual(calls, ["ada"]);
    assert.deepEqual(filterDashboardRushees(rushees, options({
        selectedSort: "lastName",
    }), fuse), [rushees[1], rushees[0], rushees[2]]);
});

test("shuffle uses one random value per item and does not mutate the source", () => {
    const draws = [0.7, 0.1, 0.4];
    const shuffled = shuffleArray(rushees, () => draws.shift());

    assert.deepEqual(shuffled, [rushees[1], rushees[2], rushees[0]]);
    assert.deepEqual(rushees.map(({ name }) => name), ["Zoe Beta", "Ada Alpha", "Bea Gamma"]);
    assert.equal(draws.length, 0);
});

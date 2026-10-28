/* Robo Run: where delivery jobs happen in the other areas of the walkable town. Exposes window.RoboExploreJobs = { sets }.
   Each set has a desk (where you take a job) and named pick-up and drop-off points, all in local coordinates (lx, lz) from the area's centre x = ox; explore.js turns them into world points.
   Names are things that exist in that area (a product-word shop, a stand, a place that already has a sign or note). A job takes a parcel from one point to another at least 40 m away. */
(function () {
  'use strict';
  const sets = {
    manjeri: { ox: 600, desk: [-2.0, 34], points: [['Auto stand, junction', -0.6, -6], ['Tea stall', 3.1, 22.6], ['Hotel Farsa', 20, 3.0], ['Hotel Oottupura', -75, 3.0], ['Hotel Zindagi', -3.0, -103], ['Vanitha Mess', 3.0, -86.5], ['Al Rayadhan', -3.0, -119], ['Budget Hyper Market', 3.0, 94], ['Zilla Money', 2.9, -126], ['Auto stand, Zilla Money', -0.6, -110], ['Medical college gate', 7, 38], ['KSRTC station', 36, 12], ['Football turf', -6.5, 40]] },
    city: { ox: 200, desk: [-2.0, 48], points: [['Railway station', 0, -44], ['EMS Stadium', 5.4, -33], ['Baby Memorial Hospital', 5.4, -5], ['Aster MIMS', -5.6, -5], ['KSEB office', 6.0, 11], ['Pharmacy', 3.4, 19.5], ['Auto stand, Mavoor Road', -0.6, 0], ['KSRTC Bus Stand', 9.5, 33.6], ['Mofussil Bus Stand', -12, 36]] },
    hilite: { ox: 400, desk: [2.0, 30], points: [['Business Park', -5.6, -21], ['Auto stand, Business Park', -0.6, -34], ['HiLITE Mall', 10.5, -20], ['Mall forecourt', 7, -24], ['Auto stand, Mall', -0.6, -10], ['UL Cyberpark', -5.6, 22], ['Bus stop', 9.5, 39.5]] }
  };
  window.RoboExploreJobs = { sets };
})();

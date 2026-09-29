const fs = require('fs');
const path = require('path');

const companiesDir = path.join(__dirname, '..', 'public', 'data', 'companies');

// Known canonical topic tags for problems that didn't have populated topics in any company file
const manualOverrides = {
  // Classic LeetCode problems renamed or with slight slug differences
  'fill-missing-data': ['Pandas'],
  'array-partition-i': ['Array', 'Greedy', 'Sorting', 'Counting Sort'],
  'implement-strstr': ['Two Pointers', 'String', 'String Matching'],
  'friend-circles': ['Depth-First Search', 'Breadth-First Search', 'Union-Find', 'Graph Theory'],
  'maximum-team-size-with-overlapping-intervals': ['Array', 'Greedy', 'Sorting'],
  'add-and-search-word-data-structure-design': ['String', 'Depth-First Search', 'Design', 'Trie'],
  'create-hello-world-function': ['JavaScript'],
  'widest-possible-fence': ['Array', 'Math', 'Greedy'],
  'create-a-dataframe-from-list': ['Pandas'],
  'to-be-or-not-to-be': ['JavaScript'],
  'minimum-cost-to-convert-string-iii': ['String', 'Graph Theory', 'Dynamic Programming', 'Shortest Path'],
  'counter': ['JavaScript'],
  'filter-elements-from-array': ['JavaScript'],
  'return-length-of-arguments-passed': ['JavaScript'],
  'array-prototype-last': ['JavaScript'],
  'cache-with-time-limit': ['JavaScript'],
  'counter-ii': ['JavaScript'],
  'sort-by': ['JavaScript'],
  'apply-transform-over-each-element-in-array': ['JavaScript'],
  'display-the-first-three-rows': ['Pandas'],
  'sleep': ['JavaScript'],
  'function-composition': ['JavaScript'],
  'memoize': ['JavaScript'],
  'promise-time-limit': ['JavaScript'],
  'reshape-data-melt': ['Pandas'],
  'reshape-data-pivot': ['Pandas'],
  'add-two-promises': ['JavaScript'],
  'maximize-sum-of-device-ratings': ['Array', 'Greedy', 'Dynamic Programming'],
  'traffic-light-controlled-intersection': ['Concurrency'],
  'coin-change-2': ['Array', 'Dynamic Programming', 'Knapsack Problem', 'Complete Knapsack'],
  'logical-or-of-two-binary-grids-represented-as-quad-trees': ['Tree', 'Divide and Conquer'],
  'students-report-by-geography': ['Database'],
  'bulb-switcher-iii': ['Array'],
  'longest-arithmetic-sequence': ['Array', 'Hash Table', 'Binary Search', 'Dynamic Programming'],
  'check-if-a-string-is-a-valid-sequence-from-root-to-leaves-path-in-a-binary-tree': ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  'palindrome-permutation-ii': ['Hash Table', 'String', 'Backtracking'],
  'maximum-area-of-two-non-overlapping-square-submatrices': ['Array', 'Dynamic Programming', 'Matrix'],
  'convert-object-to-json-string': ['JavaScript'],
  'palindrome-partitioning-iii': ['String', 'Dynamic Programming'],
  'transform-binary-string-using-subsequence-sort': ['String', 'Greedy'],
  'calculator-with-method-chaining': ['JavaScript'],
  'generate-fibonacci-sequence': ['JavaScript'],
  'select-data': ['Pandas'],
  'flip-binary-tree-to-match-preorder-traversal': ['Tree', 'Depth-First Search', 'Binary Tree'],
  'before-and-after-puzzle': ['Array', 'Hash Table', 'String', 'Sorting'],
  'second-degree-follower': ['Database'],
  'strobogrammatic-number-iii': ['Hash Table', 'Math', 'String', 'Recursion'],
  'increasing-subsequences': ['Array', 'Hash Table', 'Backtracking', 'Bit Manipulation'],
  'encode-n-ary-tree-to-binary-tree': ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Design', 'Binary Tree'],
  'reverse-subarray-to-maximize-array-value': ['Array', 'Math'],
  'make-two-arrays-equal-by-reversing-sub-arrays': ['Array', 'Hash Table', 'Sorting'],
  'chunk-array': ['JavaScript'],
  'debounce': ['JavaScript'],
  'number-of-burgers-with-no-waste-of-ingredients': ['Math'],
  'last-person-to-fit-in-the-elevator': ['Database'],
  'count-valid-sequences': ['Math', 'Dynamic Programming'],
  'unique-middle-element': ['Array', 'Hash Table'],
  'maximum-subarray-sum-after-at-most-k-swaps': ['Array', 'Dynamic Programming'],
  'check-if-object-instance-of-class': ['JavaScript'],
  'get-the-size-of-a-dataframe': ['Pandas'],
  'timeout-cancellation': ['JavaScript'],
  'allow-one-function-call': ['JavaScript'],
  'reshape-data-concatenate': ['Pandas'],
  'array-reduce-transformation': ['JavaScript'],
  'change-data-type': ['Pandas'],
  'differences-between-two-objects': ['JavaScript'],
  'flatten-deeply-nested-array': ['JavaScript'],
  'is-object-empty': ['JavaScript'],
  'memoize-ii': ['JavaScript'],
  'subsequence-after-one-replacement': ['String', 'Dynamic Programming'],
  'print-immutable-linked-list-in-reverse': ['Linked List', 'Two Pointers', 'Stack', 'Recursion'],
  'minimum-total-cost-to-process-all-elements': ['Array', 'Greedy', 'Dynamic Programming'],
  'frequency-balance-subarray': ['Array', 'Hash Table', 'Prefix Sum'],
  'minimum-cost-path-with-alternating-directions-iii': ['Graph Theory', 'Shortest Path', 'Heap (Priority Queue)'],
  'event-emitter': ['JavaScript'],
  'convert-json-string-to-object': ['JavaScript'],
  'play-with-chips': ['Array', 'Math', 'Greedy'],
  'execute-asynchronous-functions-in-parallel': ['JavaScript'],
  'squirrel-simulation': ['Math'],
  'design-a-file-system': ['Hash Table', 'String', 'Design', 'Trie'],
  'promise-pool': ['JavaScript'],
  'deep-merge-of-two-objects': ['JavaScript']
};

function normalizeKey(str) {
  return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function run() {
  const files = fs.readdirSync(companiesDir).filter(
    (f) => f.endsWith('.json') && f !== 'companies.json' && f !== 'index.json'
  );

  console.log(`Discovered ${files.length} company problem files.`);

  // 1. Build knowledge map from existing populated entries
  const slugMap = new Map();
  const titleMap = new Map();
  const normalizedKeyMap = new Map();

  for (const file of files) {
    const filePath = path.join(companiesDir, file);
    const problems = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const p of problems) {
      if (Array.isArray(p.topics) && p.topics.length > 0) {
        if (p.slug && !slugMap.has(p.slug)) {
          slugMap.set(p.slug, p.topics);
        }
        if (p.title) {
          const tKey = p.title.toLowerCase().trim();
          if (!titleMap.has(tKey)) {
            titleMap.set(tKey, p.topics);
          }
          const norm = normalizeKey(p.title);
          if (norm && !normalizedKeyMap.has(norm)) {
            normalizedKeyMap.set(norm, p.topics);
          }
        }
        if (p.slug) {
          const normSlug = normalizeKey(p.slug);
          if (normSlug && !normalizedKeyMap.has(normSlug)) {
            normalizedKeyMap.set(normSlug, p.topics);
          }
        }
      }
    }
  }

  // 2. Register manual overrides
  for (const [slug, topics] of Object.entries(manualOverrides)) {
    slugMap.set(slug, topics);
    const norm = normalizeKey(slug);
    if (norm) normalizedKeyMap.set(norm, topics);
  }

  console.log(`Total unique slugs indexed with topics: ${slugMap.size}`);

  // 3. Update files
  let totalProblems = 0;
  let totalUpdated = 0;
  let filesModified = 0;
  let stillMissing = 0;

  for (const file of files) {
    const filePath = path.join(companiesDir, file);
    const problems = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fileChanged = false;

    for (const p of problems) {
      totalProblems++;
      if (!p.topics || p.topics.length === 0) {
        // Look up topics
        let matched = null;
        if (p.slug && slugMap.has(p.slug)) {
          matched = slugMap.get(p.slug);
        } else if (p.title && titleMap.has(p.title.toLowerCase().trim())) {
          matched = titleMap.get(p.title.toLowerCase().trim());
        } else if (p.slug && normalizedKeyMap.has(normalizeKey(p.slug))) {
          matched = normalizedKeyMap.get(normalizeKey(p.slug));
        } else if (p.title && normalizedKeyMap.has(normalizeKey(p.title))) {
          matched = normalizedKeyMap.get(normalizeKey(p.title));
        }

        if (matched && matched.length > 0) {
          p.topics = [...matched];
          totalUpdated++;
          fileChanged = true;
        } else {
          stillMissing++;
          console.warn(`Unresolved problem in ${file}: ${p.slug} (${p.title})`);
        }
      }
    }

    if (fileChanged) {
      fs.writeFileSync(filePath, JSON.stringify(problems), 'utf8');
      filesModified++;
    }
  }

  console.log('\n--- Backfill Summary ---');
  console.log(`Total company files scanned: ${files.length}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total problems evaluated: ${totalProblems}`);
  console.log(`Problems updated with topics: ${totalUpdated}`);
  console.log(`Problems still missing topics: ${stillMissing}`);
}

run();

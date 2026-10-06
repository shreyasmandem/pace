// Stripe (SWE intern/new grad) × Amazon (Applied Scientist intern) sprint, Oct 7 → Oct 30, 2026.
// Day 1–20: new material (weekdays ~5.5h, weekends ~8.5h). Day 21: full mock day.
// Oct 28–29: revision. Oct 30: interview day.
//
// Sources behind every pick:
// - Stripe "What to Expect: SWE" guide (team screen: one long practical problem, 3 incremental parts,
//   implement + test in your own IDE, may involve HTTP requests; onsite adds integration + bug squash;
//   behavioural rounds use Stripe's operating principles with STAR).
// - Amazon AS intern write-ups (OA: 2 mediums + LP work-style; DSA round: distance between two tree nodes,
//   minimum window substring, interval intersections; ML depth/breadth/application; LP deep probing).
// - public/data/companies/{amazon,stripe}.json frequency lists (Amazon last 30d/3m; Stripe curated).
//
// Item helpers. Every link here is verified by build-stripe-amazon.mjs before the JSON is written.

export const lc = (slug) => ({ kind: 'lc', slug });
export const redo = (slug) => ({ kind: 'redo', slug });
export const video = (title, yt, min) => ({ kind: 'video', title: min ? `${title} (${min}m)` : title, yt });
export const read = (title, url) => ({ kind: 'read', title, url });
export const build = (title, url = null) => ({ kind: 'build', title, url });
export const mock = (title, url = null) => ({ kind: 'mock', title, url });
export const story = (title, url = null) => ({ kind: 'story', title, url });
export const drill = (title, url = null) => ({ kind: 'drill', title, url });
export const gfg = (title, url, difficulty) => ({ kind: 'gfg', title, url, difficulty });

const LP = 'https://www.amazon.jobs/content/en/our-workplace/leadership-principles';
const CS229 = 'https://cs229.stanford.edu/main_notes.pdf';
const MDN_ACCEPT_LANGUAGE = 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Language';

export const TRACK = {
  trackId: 'stripe-amazon',
  title: 'Stripe × Amazon Sprint',
};

export const DAYS = [
  {
    id: 'sa-day-01',
    title: 'Day 1 · Wed Oct 7 — Arrays & hashing · Linear regression',
    note:
      "Hash maps carry both loops: Amazon wants the O(n) answer first try, and Stripe's practical problems are mostly maps, strings and counting. Taxes (Stripe) is tiered-bracket logic, so write it with tests. ML starts at the bottom: regression, the normal equation, bias–variance. ~3h DSA · 1.5h ML · 45m setup and LPs.",
    items: [
      lc('two-sum'),
      lc('group-anagrams'),
      lc('top-k-frequent-elements'),
      lc('product-of-array-except-self'),
      lc('longest-consecutive-sequence'),
      lc('calculate-amount-paid-in-taxes'),
      build('Set up your interview IDE: run a file, read stdin/CSV, plain-assert tests (20m)', 'https://docs.python.org/3/library/csv.html'),
      video('Linear regression, clearly explained · StatQuest', '7ArmBVF2dCs', 27),
      video('Gradient descent, step by step · StatQuest', 'sDv4f4s2SB8', 24),
      video('Bias and variance · StatQuest', 'EuBBz3bI-aA', 7),
      drill('Derive the normal equation θ = (XᵀX)⁻¹Xᵀy and say when it breaks', CS229),
      story("Read Amazon's 16 LPs and Stripe's 6 operating principles; list 10 projects or moments", LP),
      video('The STAR method · Inside Amazon', 'UQrTMxouDUY', 6),
    ],
  },
  {
    id: 'sa-day-02',
    title: 'Day 2 · Thu Oct 8 — Two pointers & parsing · Logistic regression, L1/L2',
    note:
      "Atoi is Stripe's style in miniature: a spec full of edge cases (signs, whitespace, overflow), so list them before coding. Trapping Rain Water is in Amazon's last 30 days. In ML, own logistic regression end to end: likelihood → log-loss → gradient, then regularisation as a prior.",
    items: [
      lc('valid-palindrome'),
      lc('3sum'),
      lc('container-with-most-water'),
      lc('trapping-rain-water'),
      lc('string-to-integer-atoi'),
      video('Logistic regression · StatQuest', 'yIYKR4sgzI8'),
      video('Maximum likelihood, clearly explained · StatQuest', 'XepXtl9YKwc', 6),
      video('Logistic regression pt 2: maximum likelihood · StatQuest', 'BfKanl1aSG0', 10),
      video('Ridge (L2) regression · StatQuest', 'Q81RR3yKn30', 20),
      video('Lasso (L1) regression · StatQuest', 'NGf0voTMlcs', 8),
      drill('MAP view: L2 = Gaussian prior, L1 = Laplace prior; why L1 gives sparse weights', CS229),
      story('STAR: Customer Obsession + Ownership (Stripe: Users first)', LP),
    ],
  },
  {
    id: 'sa-day-03',
    title: 'Day 3 · Fri Oct 9 — Sliding window · Metrics & validation',
    note:
      "Minimum Window Substring was asked verbatim in a recent Amazon AS DSA round: code it, then give time and space for the version you wrote. Invalid Transactions is classic Stripe: parse records, group by name, check a time window. ML design answers all end in metrics, so know which fits which failure.",
    items: [
      lc('best-time-to-buy-and-sell-stock'),
      lc('longest-substring-without-repeating-characters'),
      lc('longest-repeating-character-replacement'),
      lc('minimum-window-substring'),
      lc('invalid-transactions'),
      video('The confusion matrix · StatQuest', 'Kdsp6soqA7o', 7),
      video('Sensitivity and specificity · StatQuest', 'vP06aMoz4v8', 12),
      video('ROC and AUC, clearly explained · StatQuest', '4jRBRDbJemM', 16),
      video('Cross validation · StatQuest', 'fSytzGwwBVw', 6),
      read('Accuracy, precision, recall · Google ML Crash Course', 'https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall'),
      drill('When PR-AUC beats ROC-AUC; choose a metric for 1:1000 class imbalance', 'https://developers.google.com/machine-learning/crash-course/classification/roc-and-auc'),
      story('STAR: Dive Deep + Bias for Action (Stripe: Move with urgency and focus)', LP),
    ],
  },
  {
    id: 'sa-day-04',
    title: 'Day 4 · Sat Oct 10 — Prefix sums & stacks · Decision trees · Stripe build',
    note:
      "Weekend block (~8.5h). Today's build is the closest thing to Stripe's team screen: a long spec, three escalating parts, tests you write yourself. Do it timed. Decode String and Basic Calculator II are on Stripe's list. Amazon's deep dive made a candidate compute entropy and Gini by hand, so do it on paper.",
    items: [
      lc('subarray-sum-equals-k'),
      lc('minimum-penalty-for-a-shop'),
      lc('valid-parentheses'),
      lc('daily-temperatures'),
      lc('decode-string'),
      lc('basic-calculator-ii'),
      lc('simple-bank-system'),
      build('Ledger from CSV: parse rows → account balances → reject overdrafts → per-merchant fees (75m)', 'https://docs.python.org/3/library/csv.html'),
      video('Decision and classification trees · StatQuest', '_L39rN6gz7Y', 18),
      video('Entropy for data science · StatQuest', 'YtebGVx-Fxw', 17),
      video('Regression trees · StatQuest', 'g9c66TUylZ4', 23),
      video('Random forests pt 1 · StatQuest', 'J4Wdy0Wc_xQ', 10),
      drill('By hand: entropy, Gini and information gain for a 10-row dataset; pick the best split'),
      story("STAR: Learn and Be Curious + Invent and Simplify — 'a simple fix over a complex one' (Stripe: Stay curious)", LP),
    ],
  },
  {
    id: 'sa-day-05',
    title: 'Day 5 · Sun Oct 11 — Binary search · Boosting & Bayes · Stripe mock 1',
    note:
      "Binary search on the answer (Koko, ship packages) is an Amazon OA regular. The Accept-Language parser is a reported Stripe team-screen question: three parts, each building on the last. Finish all three in 45 minutes and test as you go. ML: bagging vs boosting, and Naive Bayes from first principles.",
    items: [
      lc('search-in-rotated-sorted-array'),
      lc('find-first-and-last-position-of-element-in-sorted-array'),
      lc('koko-eating-bananas'),
      lc('capacity-to-ship-packages-within-d-days'),
      lc('find-peak-element'),
      lc('time-based-key-value-store'),
      lc('random-pick-with-weight'),
      lc('median-of-two-sorted-arrays'),
      mock('Timed 45m: Accept-Language parser — exact match → language prefix → "*" wildcard and q-weights', MDN_ACCEPT_LANGUAGE),
      video('AdaBoost, clearly explained · StatQuest', 'LsK-xG1cLYA', 21),
      video('Gradient boost pt 1: regression · StatQuest', '3CC4N4z3GJc', 16),
      video('XGBoost pt 1: regression · StatQuest', 'OtD8wVaFm6E', 26),
      video('Naive Bayes, clearly explained · StatQuest', 'O2L2Uv9pdDA', 15),
      video('K-nearest neighbours · StatQuest', 'HVXime0nQeI', 6),
      drill("Derive Naive Bayes from Bayes' rule; why the independence assumption still works"),
      story("STAR: Deliver Results + Insist on the Highest Standards — 'when did you exceed expectations?'", LP),
    ],
  },
  {
    id: 'sa-day-06',
    title: 'Day 6 · Mon Oct 12 — Linked lists · SVMs & probability',
    note:
      "Pointer problems are Amazon staples; draw before you code. Design Underground System is Stripe-flavoured: model trips with two maps and keep the API clean. Amazon's ML deep dive ended with a Bayesian coin-toss problem, so practise writing the posterior out loud.",
    items: [
      lc('reverse-linked-list'),
      lc('merge-two-sorted-lists'),
      lc('add-two-numbers'),
      lc('remove-nth-node-from-end-of-list'),
      lc('copy-list-with-random-pointer'),
      lc('design-underground-system'),
      video('Support vector machines pt 1 · StatQuest', 'efR1C6CvhmE', 21),
      video('SVMs pt 3: the RBF kernel · StatQuest', 'Qc5IyLW_hns', 16),
      video("Bayes' theorem, clearly explained · StatQuest", '9wCnvr7Xw4E', 14),
      video("Bayes' theorem, the geometry of changing beliefs · 3Blue1Brown", 'HZGCoVF3YvM', 15),
      video('Unfair coin: a Bayes interview question · Datamatician', 'ypk7hmS2Bg0', 7),
      drill('Coin problems: posterior of an unfair coin after k heads; update a prior out loud'),
      story("STAR: Are Right, A Lot — 'when were you wrong, and how did you course-correct?'", LP),
    ],
  },
  {
    id: 'sa-day-07',
    title: 'Day 7 · Tue Oct 13 — Intervals · Unsupervised learning',
    note:
      "Interval List Intersections is the exact coding question in the Amazon write-up you shared: the candidate went brute force and was told DSA wasn't at par. Do the two-pointer O(m+n) version. Meeting Rooms II and My Calendar are on Stripe's list. Amazon reportedly asks about every unsupervised method.",
    items: [
      lc('merge-intervals'),
      lc('insert-interval'),
      lc('interval-list-intersections'),
      lc('meeting-rooms-ii'),
      lc('my-calendar-i'),
      video('K-means clustering · StatQuest', '4b5d3muPQmA', 9),
      video('PCA, step by step · StatQuest', 'FgakZw6K1QQ', 22),
      video('Clustering with DBSCAN · StatQuest', 'RDZUdRSDOok', 10),
      video('Gaussian mixture models explained · DataMListic', 'wT2yLNUfyoM', 5),
      video('The EM algorithm, how it works · Victor Lavrenko', 'REypj2sy_5U', 8),
      drill('PCA two ways: covariance eigenvectors vs SVD; what "explained variance" means', CS229),
      story('STAR: Earn Trust + Have Backbone; Disagree and Commit (Stripe: Collaborate egolessly)', LP),
    ],
  },
  {
    id: 'sa-day-08',
    title: 'Day 8 · Wed Oct 14 — Heaps · Neural nets & backprop',
    note:
      "Heaps answer top-k, next-best and running-median questions. Reorganize String and Merge k Lists are in Amazon's last 30 days, and Task Scheduler is on Stripe's list too. Tonight's ML underpins everything after it: backprop, softmax, and why cross-entropy pairs with it.",
    items: [
      lc('kth-largest-element-in-an-array'),
      lc('task-scheduler'),
      lc('reorganize-string'),
      lc('merge-k-sorted-lists'),
      lc('find-median-from-data-stream'),
      video('But what is a neural network? · 3Blue1Brown', 'aircAruvnKk', 19),
      video('Gradient descent, how neural networks learn · 3Blue1Brown', 'IHZwWFHWa-w', 21),
      video('Backpropagation, intuitively · 3Blue1Brown', 'Ilg3gGewQ5U', 13),
      video('Backpropagation calculus · 3Blue1Brown', 'tIeHLnjs5U8', 10),
      video('Neural networks pt 6: cross entropy · StatQuest', '6ArSys5qHAU', 10),
      drill('Backprop by hand through a 2-layer net with softmax + cross-entropy'),
      story('STAR: Think Big + Frugality', LP),
    ],
  },
  {
    id: 'sa-day-09',
    title: 'Day 9 · Thu Oct 15 — Trees I · Optimizers & normalisation',
    note:
      "Level-order BFS is on both companies' lists, and Diameter warms you up for tomorrow's distance problems. The Amazon write-up says don't just say AdamW, explain why (decoupled weight decay), and BatchNorm vs LayerNorm was asked directly.",
    items: [
      lc('maximum-depth-of-binary-tree'),
      lc('diameter-of-binary-tree'),
      lc('binary-tree-level-order-traversal'),
      lc('binary-tree-right-side-view'),
      lc('binary-tree-zigzag-level-order-traversal'),
      lc('validate-binary-search-tree'),
      video('Optimisers: momentum, RMSprop, Adam · DeepBean', 'NE88eqLngkg', 16),
      video('Batch norm vs layer norm · DataMListic', 'o4chPk_S5C0', 5),
      read('Decoupled Weight Decay Regularization (AdamW) · Loshchilov & Hutter', 'https://arxiv.org/abs/1711.05101'),
      drill("Explain AdamW's decoupled weight decay; why Transformers use LayerNorm, not BatchNorm"),
      story('STAR: Hire and Develop the Best — mentoring or teaching someone (Stripe: Obsess over talent)', LP),
    ],
  },
  {
    id: 'sa-day-10',
    title: 'Day 10 · Fri Oct 16 — Trees II · Text & sequence models',
    note:
      "Distance between two nodes was problem 1 of an Amazon AS DSA round: it's LCA plus two depths. Derive the complexity, then handle skewed trees. ML breadth from your notes: classical text features, why neural representations win, and LSTM complexity without pen and paper.",
    items: [
      lc('lowest-common-ancestor-of-a-binary-tree'),
      gfg('Min distance between two given nodes of a binary tree', 'https://www.geeksforgeeks.org/problems/min-distance-between-two-given-nodes-of-a-binary-tree/1', 'Medium'),
      lc('all-nodes-distance-k-in-binary-tree'),
      lc('construct-binary-tree-from-preorder-and-inorder-traversal'),
      lc('kth-smallest-element-in-a-bst'),
      lc('binary-tree-maximum-path-sum'),
      video('Recurrent neural networks · StatQuest', 'AsNTP8Kwu80', 17),
      video('LSTMs, clearly explained · StatQuest', 'YCzL96nL7j0', 21),
      video('Word embedding and word2vec · StatQuest', 'viZrOnJclY0', 16),
      read('The Illustrated Word2vec · Jay Alammar', 'https://jalammar.github.io/illustrated-word2vec/'),
      drill('Classical text features (BoW, TF-IDF, n-grams, BM25) and LSTM cost intuition, no pen', 'https://en.wikipedia.org/wiki/Okapi_BM25'),
      story("STAR: a technical task you couldn't finish — how you introspected and what you'd change", LP),
    ],
  },
  {
    id: 'sa-day-11',
    title: 'Day 11 · Sat Oct 17 — Tries & backtracking · Transformers · Stripe build',
    note:
      "Stripe's onsite has an Integration round (HTTP calls, JSON, pagination), and their screen may be built around HTTP requests. Build one from scratch today. Transformers sit at the centre of Amazon's ML depth round: attention cost, and a token's journey layer by layer.",
    items: [
      lc('implement-trie-prefix-tree'),
      lc('design-add-and-search-words-data-structure'),
      lc('subsets'),
      lc('combination-sum'),
      lc('permutations'),
      lc('letter-combinations-of-a-phone-number'),
      lc('word-search'),
      lc('generate-parentheses'),
      video('What are HTTP requests? · Codecademy', '-Zea7GB2OwA', 5),
      read('How pagination works in a real API · Stripe docs', 'https://docs.stripe.com/api/pagination'),
      build('Integration drill: page through a JSON API, retry 429/5xx with backoff, aggregate results (75m)', 'https://jsonplaceholder.typicode.com/'),
      video('Attention for neural networks · StatQuest', 'PSs6nxngL6k', 16),
      video('Transformers, the tech behind LLMs · 3Blue1Brown', 'wjZofJX0v4M', 27),
      video('Attention in transformers, step by step · 3Blue1Brown', 'eMlx5fFNoYc', 26),
      video('The matrix math behind transformers · StatQuest', 'KphmOJnLAdI', 24),
      read('The Illustrated Transformer · Jay Alammar', 'https://jalammar.github.io/illustrated-transformer/'),
      drill('Derive self-attention cost O(n²·d); trace one token from embedding to next-token logits'),
      story('Record 3 stories on video, 2 minutes each; cut the filler', LP),
    ],
  },
  {
    id: 'sa-day-12',
    title: 'Day 12 · Sun Oct 18 — Graphs I · BERT, GPT & efficient LLMs · Stripe mock 2',
    note:
      "Evaluate Division is the LeetCode twin of Stripe's currency-conversion question, and Accounts Merge is on their list too. Then build the converter cold, timed. Amazon asked BERT vs GPT, masked vs causal LM, LoRA's rank decomposition and 4-bit quantisation, all in today's set.",
    items: [
      lc('number-of-islands'),
      lc('rotting-oranges'),
      lc('clone-graph'),
      lc('course-schedule'),
      lc('course-schedule-ii'),
      lc('word-ladder'),
      lc('evaluate-division'),
      lc('accounts-merge'),
      mock('Timed 45m: currency converter — direct rate → one hop → best rate over any path'),
      video('Decoder-only transformers (GPT) · StatQuest', 'bQ5BoolX9Ag', 37),
      read('The Illustrated BERT · Jay Alammar', 'https://jalammar.github.io/illustrated-bert/'),
      video('What is LoRA? Explained by its inventor · Edward Hu', 'DhRoTONcyZE', 7),
      video('The KV cache: memory usage in transformers · Efficient NLP', '80bIUggRJf4', 9),
      video('How FlashAttention speeds up attention · Jia-Bin Huang', 'gBMO1JZav44', 12),
      video('How LLMs survive in low precision (quantisation) · Julia Turc', 'qoQJq5UwV1c', 21),
      drill("BERT vs GPT: masked vs causal attention and when each wins; what LoRA's rank r controls", 'https://arxiv.org/abs/2106.09685'),
      video('Amazon behavioural interviews, LPs explained · Exponent', '6p1m2nCE7jE', 12),
      story('Fill an LP × story matrix: every LP should have at least one story'),
    ],
  },
  {
    id: 'sa-day-13',
    title: 'Day 13 · Mon Oct 19 — Graphs II · Agents, RAG & VLMs · Rate limiter',
    note:
      "Cheapest Flights and Reconstruct Itinerary are Stripe-list graph problems, and the rate limiter is one of their most reported practical questions (Stripe's own engineering blog covers the variants). ML: the hiring-manager round in your notes covered Transformers and agentic AI from CME295.",
    items: [
      lc('redundant-connection'),
      lc('network-delay-time'),
      lc('cheapest-flights-within-k-stops'),
      lc('reconstruct-itinerary'),
      read('Scaling your API with rate limiters · Stripe engineering blog', 'https://stripe.com/blog/rate-limiters'),
      build('Rate limiter per API key: fixed window → sliding log → token bucket (60m)'),
      video('CME295 lecture 7: agentic LLMs · Stanford (watch at 1.5×)', 'h-7S6HNq0Vg', 109),
      video('What is retrieval-augmented generation? · IBM', 'T-D1OfcDW1M', 7),
      video('How AI understands images (CLIP) · Computerphile', 'KcSXcpluDe4', 18),
      video('SigLIP: sigmoid loss for image–text pretraining · Papers in Public', '93yLu0S7ie0', 5),
      video('What are vision language models? · IBM', 'lOD_EE96jhM', 10),
      drill("VLM vs LLM; why SigLIP's sigmoid loss is steadier than CLIP's softmax across batches"),
      story("Drill one story five 'why?'s deep — the probing Amazon's interviewers actually do", LP),
    ],
  },
  {
    id: 'sa-day-14',
    title: 'Day 14 · Tue Oct 20 — DP I · Contrastive learning',
    note:
      "Coin Change and Coin Change II are on both lists; know the difference (fewest coins vs number of ways) cold. The AS write-up's one ML-breadth miss was growing in-batch negatives for InfoNCE when GPU memory is full. The answer is a queue of past embeddings, as in MoCo.",
    items: [
      lc('climbing-stairs'),
      lc('house-robber'),
      lc('coin-change'),
      lc('coin-change-ii'),
      lc('word-break'),
      lc('longest-increasing-subsequence'),
      video('Contrastive learning with SimCLR · Deepia', 'UqJauYELn6c', 15),
      video('Contrastive loss · ritvikmath', 'dC3_IKaBXTk', 20),
      video('MoCo (+v2): momentum contrast · Soroush Mehraban', 'gL5Hi3U8yM4', 31),
      read('Contrastive representation learning · Lilian Weng', 'https://lilianweng.github.io/posts/2021-05-31-contrastive/'),
      drill('InfoNCE: what temperature does; growing in-batch negatives when GPU memory is full', 'https://arxiv.org/abs/1911.05722'),
      story('STAR: Success and Scale Bring Broad Responsibility', LP),
    ],
  },
  {
    id: 'sa-day-15',
    title: 'Day 15 · Wed Oct 21 — DP II · Retrieval, ANN & distillation',
    note:
      "Longest Palindromic Substring is in Amazon's last 30 days. Then retrieval, which the Amazon screening went deep on: two-tower vs siamese vs cross-encoder, ANN, distillation. That candidate couldn't name the ANN parameters they had used. Never name-drop a black box: learn the knobs.",
    items: [
      lc('unique-paths'),
      lc('longest-common-subsequence'),
      lc('longest-palindromic-substring'),
      lc('edit-distance'),
      lc('partition-equal-subset-sum'),
      video('Two-tower models for recommenders · ML Simplified', 'FqA3cUWCsrk', 7),
      video('Two towers vs siamese networks vs triplet loss · DataMListic', '3CwWGSV0l9o', 4),
      video('Bi-encoder vs cross-encoder, with benchmarks · Abid Saudagar', 'tA85v3aGBIU', 12),
      video('HNSW explained · DataMListic', '77QH0Y2PYKg', 8),
      video('Product quantisation for vector search · James Briggs', 't9mRf2S5vDI', 30),
      video('Knowledge distillation explained · CodeEmporium', 'BUCSTKQOzcM', 13),
      read('Faiss index types and their parameters · Faiss wiki', 'https://github.com/facebookresearch/faiss/wiki/Faiss-indexes'),
      read('Cross-encoders vs bi-encoders · Sentence-Transformers docs', 'https://www.sbert.net/examples/cross_encoder/applications/README.html'),
      drill('ANN knobs: HNSW M / efConstruction / efSearch, IVF nlist / nprobe, PQ m: recall vs latency vs memory'),
      story('Gap check: write stories for any LP still without one', LP),
    ],
  },
  {
    id: 'sa-day-16',
    title: 'Day 16 · Thu Oct 22 — Greedy & matrix · Recommenders & cold start',
    note:
      "Greedy solutions are short, but interviewers ask why greedy works, so say it. The second half of the Amazon screening was the cold-start item problem: precomputed offline embeddings, encoders, ANN and distillation. Today you write that answer end to end.",
    items: [
      lc('maximum-subarray'),
      lc('jump-game'),
      lc('jump-game-ii'),
      lc('gas-station'),
      lc('rotate-image'),
      lc('spiral-matrix'),
      video('How Netflix recommends movies: matrix factorisation · Luis Serrano', 'ZspR5PZemcs', 33),
      video('Mitigating cold start in recommenders · TensorFlow', 'UFpF108gyaw', 6),
      read('System design for recommendations and search · Eugene Yan', 'https://eugeneyan.com/writing/system-design-for-discovery/'),
      drill('Amazon cold-start item: offline content embeddings, bi- vs cross-encoder, ANN, distillation trade-offs'),
      story('Mock: three Amazon LP questions out loud, with Pacer as the interviewer'),
    ],
  },
  {
    id: 'sa-day-17',
    title: 'Day 17 · Fri Oct 23 — Design data structures · Learning to rank',
    note:
      "LRU Cache is #2 in Amazon's last 30 days and on Stripe's list; LFU and Insert-Delete-GetRandom are Stripe favourites. In ML, the Amazon application round wanted a multi-task setup with an ad-hoc loss, and the candidate missed the hint. Practise inventing that loss.",
    items: [
      lc('lru-cache'),
      lc('insert-delete-getrandom-o1'),
      lc('lfu-cache'),
      lc('encode-and-decode-tinyurl'),
      lc('design-twitter'),
      video('Learning to rank · ritvikmath', 'YroewVVp7SM', 6),
      video('Every ranking metric: MRR, MAP, NDCG · ritvikmath', '2XegvMul_mE', 21),
      video('Multi-gate mixture of experts (MMoE) · With Regards To AI', '2GcXQ-YGJNw', 14),
      read('From RankNet to LambdaRank to LambdaMART · Microsoft Research', 'https://www.microsoft.com/en-us/research/publication/from-ranknet-to-lambdarank-to-lambdamart-an-overview/'),
      read('Multi-task loss weighting by uncertainty · Kendall et al.', 'https://arxiv.org/abs/1705.07115'),
      drill('Design a multi-task loss for search: click, add-to-cart, purchase; weighting and label leakage'),
      story('STAR: Ownership, second story — something outside your scope that you fixed', LP),
    ],
  },
  {
    id: 'sa-day-18',
    title: 'Day 18 · Sat Oct 24 — Amazon high-frequency set · ML system design · Bug squash',
    note:
      "All eight problems come from Amazon's last-90-days list; do them timed, 35 minutes each. Stripe's onsite has a bug-squash round on an unfamiliar codebase, so practise reading failing tests with a debugger. Then the round that sank the AS candidate: search relevance on Amazon.com, end to end.",
    items: [
      lc('maximum-coins-from-k-consecutive-bags'),
      lc('largest-rectangle-in-histogram'),
      lc('asteroid-collision'),
      lc('next-permutation'),
      lc('first-missing-positive'),
      lc('string-compression'),
      lc('maximum-profit-in-job-scheduling'),
      lc('sliding-window-maximum'),
      video('Start Python debugging with pdb · Real Python', 'bHx8A8tbj2c', 4),
      video('Git bisect is insanely good · Joshua Morony', 'Q-kqm0AgJZ8', 4),
      mock('Bug squash: clone a small open-source repo, run its tests, fix failures with a debugger (60m)', 'https://git-scm.com/docs/git-bisect'),
      video('System design for recommendations and search · Eugene Yan', 'lh9CNRDqKBk', 58),
      video('Design a ranking model: full mock interview · Exponent', '7_E4wnZGJKo', 48),
      drill('Write the Amazon.com search relevance design: business metric → labels → retrieval → ranking → offline/online metrics'),
      video('Prepare stories for advanced follow-ups · Amazon Bound', 'STZ-KZQkPs0', 10),
    ],
  },
  {
    id: 'sa-day-19',
    title: 'Day 19 · Sun Oct 25 — Stripe practical set · Labels & experiments · Stripe mock 3',
    note:
      "Five more problems from Stripe's own list, then a full mock in their format: three escalating parts in 45 minutes. ML: the Amazon screening opened with research data — how ground truth was set, removing outlier annotators, weighting them, and regression vs pairwise ranking.",
    items: [
      lc('alert-using-same-key-card-three-or-more-times-in-a-one-hour-period'),
      lc('validate-ip-address'),
      lc('basic-calculator'),
      lc('number-of-black-blocks'),
      lc('remove-covered-intervals'),
      mock('Timed 45m: shipping & invoice calculator — flat rates → tiered per-unit pricing → proration by days used'),
      video('Hypothesis testing and the null hypothesis · StatQuest', '0oc49DyA3hU', 15),
      video('p-values: what they are · StatQuest', 'vemZtEM63GY', 11),
      video('Statistical power · StatQuest', 'Rsc5znwR5FA', 8),
      read('How not to run an A/B test · Evan Miller', 'https://www.evanmiller.org/how-not-to-run-an-ab-test.html'),
      read('Data distribution shifts and monitoring · Chip Huyen', 'https://huyenchip.com/2022/02/07/data-distribution-shifts-and-monitoring.html'),
      read('Learning from crowds (weighting annotators) · Raykar et al., JMLR', 'https://jmlr.org/papers/v11/raykar10a.html'),
      drill('Annotators: drop outlier regression labels (median/MAD) and weight annotators by agreement'),
      drill('Regression labels vs pairwise ranking (Bradley–Terry): cost, noise, what each can learn', 'https://en.wikipedia.org/wiki/Bradley%E2%80%93Terry_model'),
      story("Map every story to Stripe's 6 operating principles and fill the gaps"),
    ],
  },
  {
    id: 'sa-day-20',
    title: 'Day 20 · Mon Oct 26 — Weak spots · ML depth (your resume)',
    note:
      "Lighter on new material. The Amazon ML-depth interviewer spent 90 minutes on one project: how it became a science problem, alternatives and why not, datasets, losses, offline and online metrics. Prepare that document for every project on your resume.",
    items: [
      lc('serialize-and-deserialize-binary-tree'),
      lc('word-search-ii'),
      drill('Re-solve the 4 problems you flagged hardest since Day 1, timed, no notes'),
      drill('Resume deep dive: for each project — science framing, alternatives and why not, data, model, loss, metrics'),
      drill('Explain your strongest project to Pacer and let it cross-examine you for 20 minutes'),
      story('Final story bank: 12 stories, each tagged with 2–3 LPs and one operating principle', LP),
      video('Stripe software engineer interview process · Exponent', 'YojGTqNM6m8', 6),
    ],
  },
  {
    id: 'sa-day-21',
    title: 'Day 21 · Tue Oct 27 — Full mock day',
    note:
      "Dress rehearsal. Run each mock under real time limits and note every stumble, because tomorrow's revision is built from that list. The hiring-manager round in your notes posed a constrained multi-class problem where a decent baseline already exists: the right move is to ship the baseline first.",
    items: [
      mock('Stripe team-screen sim, 60m: card ledger — Luhn check → masking → routing by card prefix', 'https://en.wikipedia.org/wiki/Luhn_algorithm'),
      mock('Amazon DSA mock, 60m: solve the two problems below cold and narrate complexity'),
      lc('fruit-into-baskets'),
      lc('maximum-product-subarray'),
      mock('ML breadth rapid-fire: 40 questions in 45m across Days 1–19, with Pacer as quizmaster'),
      mock('ML application mock: multi-class classification under business constraints (bias for action)'),
      mock('LP mock: 4 questions, 2 follow-ups each', LP),
    ],
  },
  {
    id: 'sa-rev-1',
    title: 'Revision 1 · Wed Oct 28 — DSA patterns & ML breadth',
    note:
      "Re-solve, don't re-read: eight problems you've already done, each in under 25 minutes. Then one pass over every ML topic, saying each answer out loud before checking it.",
    items: [
      redo('minimum-window-substring'),
      redo('interval-list-intersections'),
      redo('lru-cache'),
      redo('merge-k-sorted-lists'),
      redo('course-schedule'),
      redo('coin-change'),
      redo('lowest-common-ancestor-of-a-binary-tree'),
      redo('word-break'),
      drill('ML breadth flash review: regression → trees → boosting → NNs → Transformers → contrastive → ranking'),
      drill('Re-derive by hand: normal equation, logistic gradient, entropy/Gini split, attention cost'),
    ],
  },
  {
    id: 'sa-rev-2',
    title: 'Revision 2 · Thu Oct 29 — Stripe practical & stories',
    note:
      "Stripe day: rebuild a practical problem cold and re-solve three from their list. Then your stories and project walkthroughs, out loud. Stop by the evening and sleep.",
    items: [
      mock('Redo the Accept-Language parser cold, 45m, all three parts', MDN_ACCEPT_LANGUAGE),
      redo('invalid-transactions'),
      redo('simple-bank-system'),
      redo('evaluate-division'),
      drill('ML depth: rehearse your top 2 projects aloud, 10 minutes each'),
      story('Final pass: 12 stories, 90 seconds each, out loud', LP),
      build('Interview-day setup check: IDE, run and debug, test harness, HTTP client, quiet room'),
    ],
  },
  {
    id: 'sa-interview-day',
    title: 'Interview day · Fri Oct 30',
    note:
      "No new material. One easy warm-up, skim your stories, and set up 30 minutes early. Amazon: think aloud and give complexity before you're asked. Stripe: clarify, design, code, test, and talk the whole way.",
    items: [
      redo('two-sum'),
      story('Skim your story bank and project one-pagers (20m), nothing new'),
      drill('Before each round: restate the problem, ask about constraints, test as you go'),
    ],
  },
];

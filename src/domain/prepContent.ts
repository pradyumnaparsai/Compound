/** Static content of the switch-prep plan (Nov 15, 2026 – Jan 4, 2027). Scheduling lives in `prepPlan.ts`. */

export type Problem = { title: string; pattern: string };

export type DsaWeek = { title: string; core: Problem[]; ext: Problem[] };

/** Six study weeks; 8 core problems + 2 extension/revision slots each (5 practice days x 2 attempts). */
export const DSA_WEEKS: DsaWeek[] = [
  {
    title: 'Arrays, hashing, prefix sums, two pointers, sliding window',
    core: [
      { title: 'Subarray Sum Equals K', pattern: 'Prefix Sum + HashMap' },
      { title: 'Longest Consecutive Sequence', pattern: 'Hashing' },
      { title: 'Product of Array Except Self', pattern: 'Prefix/Suffix' },
      { title: 'Top K Frequent Elements', pattern: 'Heap / Bucket Sort' },
      { title: 'Longest Substring Without Repeating Characters', pattern: 'Sliding Window' },
      { title: 'Minimum Window Substring', pattern: 'Variable Sliding Window' },
      { title: 'Sliding Window Maximum', pattern: 'Monotonic Deque' },
      { title: 'Count Subarrays with At Most K Distinct Elements', pattern: 'Sliding Window + HashMap' },
    ],
    ext: [
      { title: '3Sum', pattern: 'Two Pointers' },
      { title: 'Trapping Rain Water', pattern: 'Two Pointers / Stack' },
    ],
  },
  {
    title: 'Binary search, monotonic stack, linked lists, tries',
    core: [
      { title: 'Search in Rotated Sorted Array', pattern: 'Binary Search' },
      { title: 'Koko Eating Bananas', pattern: 'Binary Search on Answer' },
      { title: 'Split Array Largest Sum', pattern: 'Binary Search on Answer' },
      { title: 'Meeting Rooms II', pattern: 'Sorting + Heap' },
      { title: 'Next Greater Element I', pattern: 'Monotonic Stack' },
      { title: 'Largest Rectangle in Histogram', pattern: 'Monotonic Stack' },
      { title: 'Merge k Sorted Lists', pattern: 'Heap / Divide and Conquer' },
      { title: 'Implement Trie', pattern: 'Trie' },
    ],
    ext: [
      { title: 'Reverse Nodes in k-Group', pattern: 'Linked List' },
      { title: 'Median of Two Sorted Arrays', pattern: 'Binary Search' },
    ],
  },
  {
    title: 'Trees, heaps, BFS and DFS',
    core: [
      { title: 'Binary Tree Zigzag Level Order Traversal', pattern: 'BFS' },
      { title: 'Lowest Common Ancestor of a Binary Tree', pattern: 'Tree DFS' },
      { title: 'Binary Tree Maximum Path Sum', pattern: 'Tree DP' },
      { title: 'Serialize and Deserialize Binary Tree', pattern: 'Tree Design' },
      { title: 'Number of Islands', pattern: 'Graph / Grid DFS' },
      { title: 'Rotting Oranges', pattern: 'Multi-source BFS' },
      { title: 'Clone Graph', pattern: 'Graph DFS/BFS' },
      { title: 'Find Median from Data Stream', pattern: 'Two Heaps' },
    ],
    ext: [
      { title: 'Word Ladder', pattern: 'BFS' },
      { title: 'K Closest Points to Origin', pattern: 'Heap' },
    ],
  },
  {
    title: 'Advanced graphs, topological sort, shortest paths, DSU, backtracking',
    core: [
      { title: 'Course Schedule II', pattern: 'Topological Sort' },
      { title: 'Alien Dictionary', pattern: 'Topological Sort' },
      { title: 'Network Delay Time', pattern: 'Dijkstra' },
      { title: 'Cheapest Flights Within K Stops', pattern: 'Modified Shortest Path' },
      { title: 'Number of Provinces', pattern: 'DSU (path compression + union by size/rank)' },
      { title: 'Accounts Merge', pattern: 'DSU' },
      { title: 'Evaluate Division', pattern: 'Graph Traversal' },
      { title: 'Word Search', pattern: 'Backtracking' },
    ],
    ext: [
      { title: 'Bus Routes', pattern: 'BFS on routes' },
      { title: 'Combination Sum', pattern: 'Backtracking' },
    ],
  },
  {
    title: 'Dynamic programming',
    core: [
      { title: 'House Robber II', pattern: '1D DP' },
      { title: 'Coin Change', pattern: 'Unbounded Knapsack' },
      { title: 'Longest Increasing Subsequence', pattern: 'DP + Binary Search' },
      { title: 'Word Break', pattern: 'String DP' },
      { title: 'Longest Common Subsequence', pattern: '2D DP' },
      { title: 'Edit Distance', pattern: '2D DP' },
      { title: 'Unique Paths II', pattern: 'Grid DP' },
      { title: 'Target Sum', pattern: 'Knapsack / DP' },
    ],
    ext: [
      { title: 'Partition Equal Subset Sum', pattern: 'Knapsack' },
      { title: 'House Robber III', pattern: 'Tree DP' },
    ],
  },
  {
    title: 'Greedy, intervals and company-tagged problems',
    core: [
      { title: 'Gas Station', pattern: 'Greedy' },
      { title: 'Jump Game II', pattern: 'Greedy' },
      { title: 'Insert Interval', pattern: 'Intervals' },
      { title: 'Non-overlapping Intervals', pattern: 'Greedy' },
      { title: 'Kth Element of Two Sorted Arrays', pattern: 'Binary Search' },
      { title: 'Spiral Matrix', pattern: 'Matrix' },
      { title: 'Reorganize String', pattern: 'Heap / Greedy' },
      { title: 'Binary Subarrays With Sum', pattern: 'Prefix Sum / Sliding Window' },
    ],
    ext: [
      { title: 'Time Based Key-Value Store', pattern: 'Binary Search / Design' },
      { title: 'Design Hit Counter', pattern: 'Design' },
    ],
  },
];

export type Exercise = { name: string; concepts: string };

/** One Java implementation exercise per week, spread over two days (design, then implementation). */
export const LLD: Exercise[] = [
  { name: 'Rate Limiter', concepts: 'Token Bucket, Sliding Window, Strategy, thread safety' },
  {
    name: 'Thread-safe LRU Cache',
    concepts: 'HashMap + doubly linked list, O(1) ops. get() reorders the list, so lock it as a write (synchronized / one ReentrantLock)',
  },
  { name: 'Logger Library', concepts: 'Log levels, appenders, formatting, async logging, extensibility' },
  { name: 'BNPL / Order Management System', concepts: 'Credit limits, orders, payments, concurrency, exceptions' },
  { name: 'BookMyShow / Seat Booking', concepts: 'Seat holds, TTL, booking state, concurrency, double booking' },
  { name: 'In-memory Pub-Sub Queue', concepts: 'Producer-consumer, topics, subscribers, offsets, worker threads' },
];

export const LLD_DAY1: string[] = [
  'Clarify requirements',
  'Identify entities and responsibilities',
  'Define interfaces and APIs',
  'Draw class relationships',
  'Pick patterns only where they genuinely help',
];

export const LLD_DAY2: string[] = [
  'Write complete working Java code',
  'Add meaningful test cases',
  'Handle invalid inputs and failures',
  'Add concurrency where necessary',
  'Discuss extensions and trade-offs',
];

/** One deep architecture exercise per week, spread over two days (stages 1-4, then 5-8). */
export const HLD: Exercise[] = [
  { name: 'Distributed Rate Limiter / API Gateway', concepts: 'Redis, Lua atomicity, distributed coordination, fail-open/closed' },
  { name: 'E-commerce Order & Inventory / Flash Sale', concepts: 'Stock consistency, locking, Saga, outbox, preventing overselling' },
  { name: 'High-throughput Notification System', concepts: 'Kafka, fan-out, retries, DLQ, provider throttling' },
  { name: 'Chat System (WhatsApp / Slack)', concepts: 'WebSockets, ordering, persistence, delivery guarantees' },
  { name: 'Payment Gateway / UPI Ledger', concepts: 'ACID, double-entry bookkeeping, idempotency, reconciliation' },
  { name: 'Ride-Hailing / Proximity Service', concepts: 'Geohashing, S2, QuadTrees, location ingestion, Redis Geo' },
];

export const HLD_DAY1: string[] = [
  'Requirements and assumptions',
  'Functional and non-functional requirements',
  'Capacity estimation',
  'API contracts and database schema',
];

export const HLD_DAY2: string[] = [
  'High-level architecture',
  'Component-level design',
  'Scaling bottlenecks',
  'Consistency, failure modes and trade-offs',
];

/** Backend fundamentals revision, one subject per week (30-45 min on the project/fundamentals day). */
export const FUNDAMENTALS: { subject: string; areas: string }[] = [
  { subject: 'Java', areas: 'Collections, JVM, garbage collection, synchronization, thread pools' },
  { subject: 'Databases', areas: 'Indexes, transactions, isolation, row locks, deadlocks' },
  {
    subject: 'Kafka',
    areas: 'Partitions, consumer groups, ordering, retries, idempotency. Explain duplicates, consumer crashes, downstream failure recovery',
  },
  { subject: 'Spring Boot', areas: 'DI, transactions, filters, REST, API versioning, exception handling' },
  { subject: 'Distributed Systems', areas: 'Consistency, caching, replication, outbox, Saga, circuit breaker' },
  { subject: 'Production Engineering', areas: 'Observability, incident response, debugging, RCA, reliability' },
];

export const PROJECT_TOPICS = {
  inventory: {
    name: 'Inventory / Pallet Management',
    steps: [
      'Architecture and service boundaries',
      'Spring Boot APIs and database schema',
      'Kafka event flows',
      'Concurrency and consistency',
      'Production monitoring and incident handling',
      'Your personal decisions and business impact',
    ],
  },
  migration: {
    name: 'Azure SQL → BigQuery migration',
    steps: [
      'Original architecture and limitations',
      'Incremental extraction and processing',
      'Batching and upserts',
      'Airflow orchestration',
      'Failure recovery and data correctness',
      'Performance and architectural trade-offs',
    ],
  },
} as const;

/** Eight STAR stories; prepared two per week during weeks 1-4. */
export const STAR_STORIES: string[] = [
  'Technically challenging project you owned',
  'Production incident and root-cause analysis',
  'Architectural decision you made',
  'Disagreement with a stakeholder',
  'Cross-team delivery',
  'Mistake or failed approach',
  'Mentoring a junior engineer',
  'Measurable business impact',
];

export const MOCK_RETRO_STEPS: string[] = [
  'Do the mock',
  'Record knowledge gaps and missing edge cases / trade-offs',
  'Record coding mistakes, communication and time-management issues',
];

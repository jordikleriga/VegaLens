/**
 * Elasticsearch Test Fixtures
 *
 * Mock Elasticsearch indices, mappings, and sample data for testing
 */

export const mockIndices = [
  {
    name: 'kibana_sample_data_ecommerce',
    health: 'green',
    status: 'open',
    uuid: 'abc123',
    pri: '1',
    rep: '1',
    'docs.count': '4675',
    'docs.deleted': '0',
    'store.size': '4.5mb',
    'pri.store.size': '4.5mb'
  },
  {
    name: 'kibana_sample_data_logs',
    health: 'green',
    status: 'open',
    uuid: 'def456',
    pri: '1',
    rep: '1',
    'docs.count': '14074',
    'docs.deleted': '0',
    'store.size': '11.5mb',
    'pri.store.size': '11.5mb'
  }
]

export const mockMapping = {
  properties: {
    customer_name: { type: 'keyword' },
    customer_gender: { type: 'keyword' },
    order_date: { type: 'date' },
    order_id: { type: 'keyword' },
    day_of_week: { type: 'keyword' },
    taxful_total_price: { type: 'float' },
    total_quantity: { type: 'integer' },
    products: {
      type: 'nested',
      properties: {
        product_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        product_id: { type: 'keyword' },
        category: { type: 'keyword' },
        price: { type: 'float' },
        quantity: { type: 'integer' }
      }
    },
    geoip: {
      properties: {
        country_iso_code: { type: 'keyword' },
        location: { type: 'geo_point' },
        city_name: { type: 'keyword' }
      }
    }
  }
}

export const mockSampleData = [
  {
    customer_name: 'Eddie Underwood',
    customer_gender: 'MALE',
    order_date: '2024-01-15T10:30:00Z',
    order_id: 'ORD-001',
    day_of_week: 'Monday',
    taxful_total_price: 124.50,
    total_quantity: 3,
    products: [
      {
        product_name: 'Laptop Bag',
        product_id: 'PROD-123',
        category: 'Accessories',
        price: 45.50,
        quantity: 1
      }
    ]
  },
  {
    customer_name: 'Mary Bailey',
    customer_gender: 'FEMALE',
    order_date: '2024-01-16T14:22:00Z',
    order_id: 'ORD-002',
    day_of_week: 'Tuesday',
    taxful_total_price: 299.99,
    total_quantity: 2,
    products: [
      {
        product_name: 'Wireless Mouse',
        product_id: 'PROD-456',
        category: 'Electronics',
        price: 29.99,
        quantity: 2
      }
    ]
  }
]

export const mockFieldCategories = {
  keyword: [
    { name: 'customer_name', type: 'keyword' },
    { name: 'customer_gender', type: 'keyword' },
    { name: 'day_of_week', type: 'keyword' },
    { name: 'order_id', type: 'keyword' }
  ],
  date: [
    { name: 'order_date', type: 'date' }
  ],
  numeric: [
    { name: 'taxful_total_price', type: 'float' },
    { name: 'total_quantity', type: 'integer' }
  ],
  nested: [
    { name: 'products', type: 'nested' }
  ],
  geo: [
    { name: 'geoip.location', type: 'geo_point' }
  ]
}



// ==========================================
// preprocessing
// ==========================================

db.campaigns.insertOne({
  campaign_id: 0,
  channel: "Organic / Direct",
  objective: "No Campaign",
  start_date: null,
  end_date: null,
  target_segment: "All Customers",
  expected_uplift: 0.0
});


// ==========================================
//  preprocessing
// ==========================================
db.events.updateMany(

  { 
    traffic_source: { $type: "string" } 
  },
  
  [
    {
      $set: {
        traffic_source: {
          $let: {
            vars: { 
              lowered: { $toLower: "$traffic_source" } 
            },
            in: {
              $concat: [
                { $toUpper: { $substrCP: [ "$$lowered", 0, 1 ] } },
                
                { $substrCP: [ "$$lowered", 1, { $strLenCP: "$$lowered" } ] }
              ]
            }
          }
        }
      }
    }
  ]
);


// ==========================================
//  creazione transactions_denomalized
// ==========================================
db.transactions.aggregate([
  {
    $lookup: {
      from: "customers",
      localField: "customer_id",
      foreignField: "customer_id",
      as: "customer_details"
    }
  },
  {
    $unwind: {
      path: "$customer_details",
      preserveNullAndEmptyArrays: true
    }
  },

  {
    $lookup: {
      from: "products",
      localField: "product_id",
      foreignField: "product_id",
      as: "product_details"
    }
  },
  {
    $unwind: {
      path: "$product_details",
      preserveNullAndEmptyArrays: true
    }
  },

  {
    $lookup: {
      from: "campaigns",
      localField: "campaign_id",
      foreignField: "campaign_id",
      as: "campaign_details"
    }
  },
  {
    $unwind: {
      path: "$campaign_details",
      preserveNullAndEmptyArrays: true
    }
  },

  {
    $project: {
      _id: 1, 
      transaction_id: 1,
      timestamp: 1,
      quantity: 1,
      discount_applied: 1,
      gross_revenue: 1,
      refund_flag: 1,
      
      customer_details: 1, 
      product_details: 1,
      campaign_details: 1
      
    }
  },

  {
    $out: "transactions_denormalized"
  }
], 
{ 

});



// ==========================================
//creazione events_denormalized
// ==========================================
db.events.aggregate([
  {
    $lookup: {
      from: "customers",
      localField: "customer_id",
      foreignField: "customer_id",
      as: "customer_details"
    }
  },
  {
    $unwind: {
      path: "$customer_details",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $lookup: {
      from: "products",
      localField: "product_id",
      foreignField: "product_id",
      as: "product_details"
    }
  },
  {
    $unwind: {
      path: "$product_details",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $lookup: {
      from: "campaigns",
      localField: "campaign_id",
      foreignField: "campaign_id",
      as: "campaign_details"
    }
  },
  {
    $unwind: {
      path: "$campaign_details",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $project: {
      _id: 1,
      event_id: 1,
      timestamp: 1,
      session_id: 1,
      event_type: 1,
      device_type: 1,
      traffic_source: 1,
      page_category: 1,
      session_duration_sec: 1,
      experiment_group: 1,
      campaign_id: 1,
      customer_details: 1,
      product_details: 1,
      campaign_details: 1
    }
  },
  {
    $out: "events__denormalized"
  }
], 
{ 
  allowDiskUse: true 
});


// ==========================================
//query 1 in enriched transaction
// ==========================================

[
  {
    $match: {
      product_details: {
        $ne: null
      }
    }
  },
  {
    $group: {
      _id: "$product_details.is_premium",
      total_items_sold: {
        $sum: "$quantity"
      },
      avg_gross_revenue: {
        $avg: "$gross_revenue"
      }
    }
  },
  {
    $project: {
      _id: 0,
      is_premium: "$_id",
      total_items_sold: 1,
      avg_gross_revenue: {
        $round: ["$avg_gross_revenue", 2]
      }
    }
  }
]

// ==========================================
//query 3 in enriched transaction
// ==========================================
[
  {
    $set: {
      tipo_acquisto: {
        $cond: [
          { $gt: ["$discount_applied", 0] },
          "Discounted Price",
          "Full price"
        ]
      },
      valore_rimborso: {
        $cond: ["$refund_flag", 1, 0]
      }
    }
  },

  {
    $group: {
      _id: "$tipo_acquisto",
      total_transactions: { $sum: 1 },
      total_refunds: { $sum: "$valore_rimborso" }
    }
  },

  {
    $project: {
      _id: 0,
      purchase_type: "$_id",
      total_transactions: 1,
      total_refunds: 1,
      refund_rate_percentage: {
        $round: [
          {
            $multiply: [
              {
                $divide: [
                  "$total_refunds",
                  "$total_transactions"
                ]
              },
              100
            ]
          },
          2
        ]
      }
    }
  }
]

// ==========================================
//query 6 in enriched transaction
// ==========================================

[
  {
    $match: {
      product_details: {
        $ne: null
      }
    }
  },
  {
    $group: {
      _id: "$product_details.category",
      total_transactions: {
        $sum: 1
      },
      refunds: {
        $sum: "$refund_flag"
      }
    }
  },
  {
    $project: {
      _id: 0,
      category: "$_id",
      total_transactions: 1,
      refunds: 1,
      refund_rate_pct: {
        $round: [
          {
            $multiply: [
              {
                $divide: [
                  "$refunds",
                  "$total_transactions"
                ]
              },
              100
            ]
          },
          2
        ]
      }
    }
  },
  {
    $sort: {
      refund_rate_pct: -1
    }
  }
]


// ==========================================
//query 10 in enriched transaction
// ==========================================
[
  {
    $lookup: {
      from: "events",
      let: {
        t_cust: "$customer_details.customer_id",
        t_prod: "$product_details.product_id",
        t_time: "$timestamp"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$customer_id", "$$t_cust"] },
                { $eq: ["$product_id", "$$t_prod"] },
                { $lt: ["$timestamp", "$$t_time"] },
                { $in: ["$event_type", ["view", "click", "add_to_cart"]] }
              ]
            }
          }
        },
        { $limit: 1 }
      ],
      as: "prior_events"
    }
  },
  {
    $match: {
      prior_events: { $size: 0 }
    }
  },
  {
    $group: {
      _id: {
        $switch: {
          branches: [
            { case: { $lt:  ["$customer_details.age", 25] }, then: "Under 25" },
            { case: { $lte: ["$customer_details.age", 34] }, then: "25-34" },
            { case: { $lte: ["$customer_details.age", 44] }, then: "35-44" },
            { case: { $lte: ["$customer_details.age", 54] }, then: "45-54" }
          ],
          default: "55+"
        }
      },
      impulse_purchases: { $sum: 1 },
      raw_avg_revenue: { $avg: "$gross_revenue" }
    }
  },
  {
    $project: {
      _id: 0,
      age_group: "$_id",
      impulse_purchases: 1,
      avg_impulse_revenue: { $round: ["$raw_avg_revenue", 2] }
    }
  },
  {
    $sort: { impulse_purchases: -1 }
  }
]
// ==========================================
//query 4 in enriched events
// ==========================================

[
  {
    $match: {
      "campaign_details.channel": { $ne: null }
    }
  },
  {
    $group: {
      _id: {
        campaign_id: "$campaign_id",
        channel: "$campaign_details.channel"
      },
      total_clicks: {
        $sum: {
          $cond: [
            {
              $and: [
                {
                  $eq: ["$event_type", "click"]
                },
                {
                  $gte: [
                    "$timestamp",
                    "2022-01-01"
                  ]
                }
              ]
            },
            1,
            0
          ]
        }
      }
    }
  },
  {
    $lookup: {
      from: "transactions",
      let: { c_id: "$_id.campaign_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$campaign_id", "$$c_id"]
            },
            timestamp: { $gte: "2022-01-01" }
          }
        },
        {
          $group: {
            _id: null,
            total_revenue: {
              $sum: "$gross_revenue"
            }
          }
        }
      ],
      as: "txn_data"
    }
  },
  {
    $project: {
      _id: 0,
      campaign_id: "$_id.campaign_id",
      channel: "$_id.channel",
      total_clicks: 1,
      total_revenue: {
        $round: [
          {
            $ifNull: [
              {
                $arrayElemAt: [
                  "$txn_data.total_revenue",
                  0
                ]
              },
              0
            ]
          },
          2
        ]
      }
    }
  },
  {
    $sort: {
      campaign_id: 1
    }
  }
]

// ==========================================
//query 5 in enriched events
// ==========================================
[
  {
    $match: {
      "product_details.is_premium": 1
    }
  },
  {
    $group: {
      _id: {
        product_id: "$product_details.product_id",
        category: "$product_details.category"
      },
      total_views: {
        $sum: {
          $cond: [
            {
              $and: [
                {
                  $eq: ["$event_type", "view"]
                },
                {
                  $gte: [
                    "$timestamp",
                    "2022-01-01"
                  ]
                }
              ]
            },
            1,
            0
          ]
        }
      }
    }
  },
  {
    $lookup: {
      from: "transactions",
      let: {
        p_id: "$_id.product_id"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$product_id", "$$p_id"]
            },
            timestamp: {
              $gte: "2022-01-01"
            }
          }
        },
        {
          $group: {
            _id: null,
            total_revenue: {
              $sum: "$gross_revenue"
            }
          }
        }
      ],
      as: "txn_data"
    }
  },
  {
    $project: {
      _id: 0,
      product_id: "$_id.product_id",
      category: "$_id.category",
      total_views: 1,
      total_revenue: {
        $round: [
          {
            $ifNull: [
              {
                $arrayElemAt: [
                  "$txn_data.total_revenue",
                  0
                ]
              },
              0
            ]
          },
          2
        ]
      }
    }
  },
  {
    $sort: {
      product_id: 1
    }
  }
]
// ==========================================
//query 7 in enriched events
// ==========================================
[
  {
    $match: {
      event_type: "click",
      traffic_source: {
        $ne: null
      },
      "customer_details.customer_id": {
        $ne: null
      }
    }
  },
  {
    $group: {
      _id: {
        traffic_source: "$traffic_source",
        customer_id:
          "$customer_details.customer_id"
      }
    }
  },
  {
    $lookup: {
      from: "transactions",
      let: {
        cust_id: "$_id.customer_id"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$customer_id", "$$cust_id"]
            }
          }
        },
        {
          $limit: 1
        }
      ],
      as: "user_transactions"
    }
  },
  {
    $match: {
      user_transactions: {
        $size: 0
      }
    }
  },
  {
    $group: {
      _id: "$_id.traffic_source",
      customers_clicked_not_bought: {
        $sum: 1
      }
    }
  },
  {
    $project: {
      _id: 0,
      traffic_source: "$_id",
      customers_clicked_not_bought: 1
    }
  },
  {
    $sort: {
      customers_clicked_not_bought: -1
    }
  }
]
// ==========================================
//query 9 in enriched events
// ==========================================
[
  {
    $match: {
      device_type: { $ne: null }
    }
  },
  {
    $facet: {
      device_stats: [
        {
          $group: {
            _id: {
              device: "$device_type",
              session: "$session_id"
            },
            has_purchase: {
              $max: {
                $cond: [{ $eq: ["$event_type", "purchase"] }, 1, 0]
              }
            },
            avg_duration: { $avg: "$session_duration_sec" }
          }
        },
        {
          $group: {
            _id: "$_id.device",
            total_sessions: { $sum: 1 },
            purchasing_sessions: { $sum: "$has_purchase" },
            avg_session_duration: { $avg: "$avg_duration" }
          }
        }
      ],
      global_stats: [
        {
          $group: {
            _id: null,
            global_avg: { $avg: "$session_duration_sec" }
          }
        }
      ]
    }
  },
  {
    $unwind: "$device_stats"
  },
  {
    $project: {
      _id: 0,
      device_type: "$device_stats._id",
      total_sessions: "$device_stats.total_sessions",
      conversion_rate_pct: {
        $round: [
          {
            $multiply: [
              { $divide: ["$device_stats.purchasing_sessions", "$device_stats.total_sessions"] },
              100
            ]
          },
          2
        ]
      },
      avg_session_duration: {
        $round: ["$device_stats.avg_session_duration", 2]
      },
      global_avg_duration: {
        $round: [{ $arrayElemAt: ["$global_stats.global_avg", 0] }, 2]
      }
    }
  },
  {
    $sort: { conversion_rate_pct: -1 }
  }
]

// ==========================================
//query 2 in events
// ==========================================

[
  {
    $match: {
      campaign_id: {
        $ne: null
      }
    }
  },
  {
    $project: {
      _id: 0,
      campaign_id: 1,
      customer_id: 1
    }
  },
  {
    $group: {
      _id: {
        campaign_id: "$campaign_id",
        customer_id: "$customer_id"
      }
    }
  },
  {
    $lookup: {
      from: "transactions",
      let: {
        ev_campaign: "$_id.campaign_id",
        ev_customer: "$_id.customer_id"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [
                    "$campaign_id",
                    "$$ev_campaign"
                  ]
                },
                {
                  $eq: [
                    "$customer_id",
                    "$$ev_customer"
                  ]
                }
              ]
            }
          }
        },
        {
          $limit: 1
        }
      ],
      as: "matched_transactions"
    }
  },
  {
    $addFields: {
      is_buyer: {
        $gt: [
          {
            $size: "$matched_transactions"
          },
          0
        ]
      }
    }
  },
  {
    $group: {
      _id: "$_id.campaign_id",
      unique_visitors: {
        $sum: 1
      },
      unique_buyers: {
        $sum: {
          $cond: ["$is_buyer", 1, 0]
        }
      }
    }
  },
  {
    $project: {
      _id: 0,
      campaign_id: "$_id",
      unique_visitors: 1,
      unique_buyers: 1,
      conversion_rate: {
        $round: [
          {
            $cond: {
              if: {
                $gt: ["$unique_visitors", 0]
              },
              then: {
                $multiply: [
                  {
                    $divide: [
                      "$unique_buyers",
                      "$unique_visitors"
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          },
          2
        ]
      }
    }
  },
  {
    $sort: {
      conversion_rate: -1
    }
  }
]

// ==========================================
//query 8 in events
// ==========================================
[
  {
    $match: { event_type: "purchase" }
  },

  {
    $lookup: {
      from: "transactions",
      localField: "customer_id",
      foreignField: "customer_id",
      as: "txns"
    }
  },

  { $match: { txns: { $ne: [] } } },

  { $unwind: "$txns" },

  {
    $group: {
      _id: { $toLower: "$traffic_source" },
      transaction_ids: {
        $addToSet: "$txns.transaction_id"
      },
      total_revenue: {
        $sum: "$txns.gross_revenue"
      },
      revenues: { $push: "$txns.gross_revenue" }
    }
  },

  {
    $project: {
      _id: 0,
      traffic_source: "$_id",
      total_purchases: {
        $size: "$transaction_ids"
      },
      total_revenue: {
        $round: ["$total_revenue", 2]
      },
      avg_revenue_per_purchase: {
        $round: [{ $avg: "$revenues" }, 2]
      }
    }
  },

  { $sort: { total_revenue: -1 } }
]

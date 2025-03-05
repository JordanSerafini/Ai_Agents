/**
 * Requêtes pour la gestion des fournisseurs
 */
export const SUPPLIER_QUERIES = {
  // Récupérer tous les fournisseurs
  GET_ALL: `
    SELECT * FROM suppliers
    ORDER BY name;
  `,

  // Récupérer un fournisseur par son ID
  GET_BY_ID: `
    SELECT * FROM suppliers
    WHERE id = $1;
  `,

  // Rechercher des fournisseurs par nom
  SEARCH: `
    SELECT * FROM suppliers
    WHERE name ILIKE $1 OR contact_name ILIKE $1
    ORDER BY name;
  `,

  // Créer un nouveau fournisseur
  CREATE: `
    INSERT INTO suppliers (
      name, contact_name, email, phone, address, 
      website, notes, payment_terms
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `,

  // Mettre à jour un fournisseur
  UPDATE: `
    UPDATE suppliers
    SET 
      name = $2,
      contact_name = $3,
      email = $4,
      phone = $5,
      address = $6,
      website = $7,
      notes = $8,
      payment_terms = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Supprimer un fournisseur
  DELETE: `
    DELETE FROM suppliers
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer tous les produits
  GET_ALL_PRODUCTS: `
    SELECT 
      p.*,
      s.name as supplier_name,
      c.name as category_name
    FROM products p
    JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_categories c ON p.category_id = c.id
    ORDER BY p.name;
  `,

  // Récupérer les produits d'un fournisseur
  GET_SUPPLIER_PRODUCTS: `
    SELECT 
      p.*,
      c.name as category_name
    FROM products p
    LEFT JOIN product_categories c ON p.category_id = c.id
    WHERE p.supplier_id = $1
    ORDER BY p.name;
  `,

  // Récupérer un produit par son ID
  GET_PRODUCT_BY_ID: `
    SELECT 
      p.*,
      s.name as supplier_name,
      c.name as category_name
    FROM products p
    JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN product_categories c ON p.category_id = c.id
    WHERE p.id = $1;
  `,

  // Créer un nouveau produit
  CREATE_PRODUCT: `
    INSERT INTO products (
      supplier_id, category_id, name, reference, description, 
      unit_price, unit, min_order_quantity, lead_time_days, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `,

  // Mettre à jour un produit
  UPDATE_PRODUCT: `
    UPDATE products
    SET 
      supplier_id = $2,
      category_id = $3,
      name = $4,
      reference = $5,
      description = $6,
      unit_price = $7,
      unit = $8,
      min_order_quantity = $9,
      lead_time_days = $10,
      notes = $11,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer toutes les commandes fournisseurs
  GET_ALL_ORDERS: `
    SELECT 
      so.*,
      s.name as supplier_name,
      p.name as project_name
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN projects p ON so.project_id = p.id
    ORDER BY so.order_date DESC;
  `,

  // Récupérer les commandes d'un fournisseur
  GET_SUPPLIER_ORDERS: `
    SELECT 
      so.*,
      p.name as project_name
    FROM supplier_orders so
    LEFT JOIN projects p ON so.project_id = p.id
    WHERE so.supplier_id = $1
    ORDER BY so.order_date DESC;
  `,

  // Récupérer les commandes d'un projet
  GET_PROJECT_ORDERS: `
    SELECT 
      so.*,
      s.name as supplier_name
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    WHERE so.project_id = $1
    ORDER BY so.order_date DESC;
  `,

  // Récupérer une commande par son ID
  GET_ORDER_BY_ID: `
    SELECT 
      so.*,
      s.name as supplier_name,
      p.name as project_name
    FROM supplier_orders so
    JOIN suppliers s ON so.supplier_id = s.id
    LEFT JOIN projects p ON so.project_id = p.id
    WHERE so.id = $1;
  `,

  // Créer une nouvelle commande
  CREATE_ORDER: `
    INSERT INTO supplier_orders (
      supplier_id, project_id, reference, order_date, expected_delivery_date,
      status, total_amount, shipping_cost, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `,

  // Mettre à jour une commande
  UPDATE_ORDER: `
    UPDATE supplier_orders
    SET 
      supplier_id = $2,
      project_id = $3,
      reference = $4,
      order_date = $5,
      expected_delivery_date = $6,
      actual_delivery_date = $7,
      status = $8,
      total_amount = $9,
      shipping_cost = $10,
      notes = $11,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer les éléments d'une commande
  GET_ORDER_ITEMS: `
    SELECT 
      oi.*,
      p.name as product_name,
      p.reference as product_reference,
      p.unit as product_unit
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = $1
    ORDER BY oi.id;
  `,

  // Ajouter un élément à une commande
  ADD_ORDER_ITEM: `
    INSERT INTO order_items (
      order_id, product_id, quantity, unit_price, total_price, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `,

  // Mettre à jour un élément de commande
  UPDATE_ORDER_ITEM: `
    UPDATE order_items
    SET 
      product_id = $2,
      quantity = $3,
      unit_price = $4,
      total_price = $5,
      notes = $6
    WHERE id = $1
    RETURNING id;
  `,

  // Supprimer un élément de commande
  DELETE_ORDER_ITEM: `
    DELETE FROM order_items
    WHERE id = $1
    RETURNING id;
  `,

  // Récupérer les évaluations d'un fournisseur
  GET_SUPPLIER_RATINGS: `
    SELECT 
      sr.*,
      CONCAT(s.firstname, ' ', s.lastname) as staff_name
    FROM supplier_ratings sr
    LEFT JOIN staff s ON sr.staff_id = s.id
    WHERE sr.supplier_id = $1
    ORDER BY sr.rating_date DESC;
  `,

  // Ajouter une évaluation de fournisseur
  ADD_SUPPLIER_RATING: `
    INSERT INTO supplier_ratings (
      supplier_id, staff_id, rating, comments, rating_date
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `,

  // Récupérer les meilleurs fournisseurs
  GET_TOP_SUPPLIERS: `
    SELECT 
      s.id,
      s.name,
      COUNT(sr.id) as total_ratings,
      ROUND(AVG(sr.rating), 1) as average_rating
    FROM suppliers s
    JOIN supplier_ratings sr ON s.id = sr.supplier_id
    GROUP BY s.id, s.name
    HAVING COUNT(sr.id) >= 3
    ORDER BY average_rating DESC
    LIMIT $1;
  `,
};

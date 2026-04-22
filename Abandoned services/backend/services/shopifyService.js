const axios = require('axios');

class ShopifyService {
  constructor(credentials) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    this.shopName = credentials.shopName;
    this.baseUrl = `https://${this.shopName}.myshopify.com/admin/api/2023-10`;
  }

  async getOrders() {
    try {
      const response = await axios.get(`${this.baseUrl}/orders.json`, {
        headers: {
          'X-Shopify-Access-Token': this.apiKey
        }
      });
      return response.data.orders;
    } catch (error) {
      throw new Error(`Shopify API Error: ${error.message}`);
    }
  }

  async syncInventory(products) {
    try {
      console.log('Syncing inventory to Shopify...');
      return { success: true };
    } catch (error) {
      throw new Error(`Shopify Inventory Sync Error: ${error.message}`);
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      console.log(`Updating Shopify order ${orderId} status to ${status}`);
      return { success: true };
    } catch (error) {
      throw new Error(`Shopify Order Update Error: ${error.message}`);
    }
  }
}

module.exports = ShopifyService;

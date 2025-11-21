# KEDI Marketplace

A full-stack marketplace platform connecting farmers and buyers in Rwanda, built with Next.js, Express, and MongoDB.

## Features

- **User Authentication**: Signup/Login with roles (Buyer, Seller, Admin)
- **Product Management**: Sellers can add/manage products with categories
- **Order System**: Buyers can place orders with inventory tracking
- **Payment Integration**: Mock system for MTN Momo, Airtel Money, Credit Card
- **File Uploads**: Product image uploads
- **Admin Panel**: Approve sellers, view sales reports
- **Search**: Product search and filtering

## Tech Stack

- **Frontend**: Next.js 13+, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB, JWT
- **Payments**: Ready for MTN Momo/Airtel APIs

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd MarketPlace
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Create .env file with:
   # MONGO_URI=mongodb://localhost:27017/kedi-marketplace
   # PORT=5000
   # JWT_SECRET=your_jwt_secret_here
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Sample Data

Use API endpoints to add sample data:

1. **Create Admin User**
   ```bash
   curl -X POST http://localhost:5000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Admin","email":"admin@kedi.com","password":"admin123","role":"admin"}'
   ```

2. **Create Categories**
   ```bash
   curl -X POST http://localhost:5000/api/categories \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <admin-token>" \
     -d '{"name":"Ubuhinzi","description":"Agriculture products"}'
   ```

3. **Add Products** (as seller)

## API Endpoints

### Auth
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products (with search/category filters)
- `POST /api/products` - Create product (sellers only)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `POST /api/orders` - Place order (buyers)
- `GET /api/orders` - Get user's orders
- `GET /api/orders/seller` - Get orders for seller's products

### Payments
- `POST /api/payments` - Initiate payment

### Admin
- `GET /api/admin/sellers` - List sellers
- `PUT /api/admin/approve-seller/:id` - Approve seller
- `GET /api/admin/reports/sales` - Daily sales report

## Testing

1. Start MongoDB
2. Run backend: `npm start` in backend/
3. Run frontend: `npm run dev` in frontend/
4. Test user flows:
   - Signup/Login
   - Add products (seller)
   - Browse/place orders (buyer)
   - Admin approval

## Deployment

- **Backend**: Deploy to Render/Heroku
- **Frontend**: Deploy to Vercel/Netlify
- **Database**: MongoDB Atlas for production

## Future Enhancements

- Real payment API integration
- Cart functionality
- Product reviews
- Email notifications
- Mobile app
- Advanced analytics

## License

MIT License
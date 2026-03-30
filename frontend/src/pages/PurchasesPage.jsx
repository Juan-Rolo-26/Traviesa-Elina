import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCustomerOrders } from "../api";

function formatPrice(num) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(num);
}

function getStatusBadge(status, paymentStatus) {
  if (status === "rejected") {
    return <span className="my-purchases-badge rejected">Rechazado</span>;
  }
  if (status === "paid" || paymentStatus === "approved" || status === "confirmed") {
    return <span className="my-purchases-badge confirmed">Confirmado</span>;
  }
  return <span className="my-purchases-badge pending">Pendiente</span>;
}

function PurchasesPage({ customerProfile }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token || !customerProfile) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    fetchCustomerOrders(token)
      .then(data => {
        if (data.error) throw new Error(data.error);
        setOrders(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [customerProfile]);

  if (loading) {
    return <div className="my-purchases-container" style={{padding: '60px 20px', textAlign: 'center'}}>Cargando compras...</div>;
  }

  if (!customerProfile) {
    return (
      <section className="form purchases-empty">
        <h2>Mis compras</h2>
        <p className="purchases-empty-title">¡Iniciá sesión para ver tus compras!</p>
        <p className="helper purchases-empty-subtitle">
          Tus compras se vinculan a tu cuenta. Ingresá o registrate para ver tu historial.
        </p>
      </section>
    );
  }

  if (error) {
    return <div className="my-purchases-container" style={{padding: '60px 20px', textAlign: 'center', color: 'red'}}>Error: {error}</div>;
  }

  if (orders.length === 0) {
    return (
      <section className="form purchases-empty">
         <h2>Mis compras</h2>
         <p className="purchases-empty-title">¡Aún no ingresaste un pedido!</p>
         <p className="helper purchases-empty-subtitle">
            Hacé tu primera compra para verla acá.
         </p>
         <Link to="/" className="button secondary" style={{marginTop:'20px', display:'inline-block'}}>Ir a la tienda</Link>
      </section>
    );
  }

  return (
    <div className="my-purchases-container">
       <h1 className="my-purchases-title">Mis compras</h1>
       <div className="my-purchases-list">
          {orders.map(order => (
             <div key={order.id} className="my-purchase-card">
               <div className="mp-header">
                 <div className="mp-header-info">
                   <p className="mp-date">{new Date(order.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                   <p className="mp-order-id">Orden #{String(order.id).replace(/\D/g, '').slice(-5).padStart(5, String(order.id).slice(-1).toUpperCase() || 'A')}</p>
                 </div>
                 <div className="mp-status">
                   {getStatusBadge(order.status, order.paymentStatus)}
                 </div>
               </div>
               
               <div className="mp-body">
                 {order.items?.map((item, index) => (
                   <div key={index} className="mp-item-row">
                     <div className="mp-item-img">
                       {(item.productImage || item.product?.image) ? (
                          <img src={item.productImage || item.product?.image} alt={item.productName || item.product?.name} />
                       ) : (
                          <div className="mp-placeholder-img">No Image</div>
                       )}
                     </div>
                     <div className="mp-item-details">
                       <p className="mp-item-name">{item.productName || item.product?.name}</p>
                       <p className="mp-item-qty">{item.quantity} un. x {formatPrice(item.productPrice)}</p>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="mp-footer">
                 <p className="mp-total-label">Total</p>
                 <p className="mp-total-amount">{formatPrice(order.totalAmount)}</p>
               </div>
             </div>
          ))}
       </div>
    </div>
  );
}

export default PurchasesPage;

// The demo catalog: realistic checkout strings with the placeholders that break apps.
export const SAMPLE = JSON.stringify(
  {
    app: { title: "Sweekly Shop", tagline: "Everything you need, delivered tomorrow." },
    cart: {
      items: "%d items in your cart",
      empty: "Your cart is empty.",
      remove: "Remove",
      subtotal: "Subtotal: {amount}",
    },
    checkout: {
      pay: "Pay {amount} now",
      shipping: "Ships to {city} in {days} days",
      promo: "Use code <b>{code}</b> to save {percent}%",
      terms: "By paying you accept our <a href=\"/terms\">terms</a>.",
      error: "Payment failed. Try again or use another card.",
    },
    account: {
      greeting: "Welcome back, {{name}}!",
      orders: "You have %1$d open orders since %2$s",
      pro: "Upgrade to Sweekly Plus",
      logout: "Sign out",
    },
  },
  null,
  2,
);

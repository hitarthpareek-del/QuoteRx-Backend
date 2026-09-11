const app = require("./app");
const {
    startQuotationExpiryScheduler
} = require("./modules/quotations/schedulers/quotation-expiry.scheduler");
const {
    startQuotationFollowUpScheduler
} = require("./modules/quotations/schedulers/quotation-followup.scheduler");
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startQuotationExpiryScheduler();
  startQuotationFollowUpScheduler();
});
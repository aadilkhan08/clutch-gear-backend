/**
 * PDF Invoice Service
 * Generates PDF invoices for payments
 */
const PDFDocument = require("pdfkit");
const config = require("../config");

/**
 * Generate invoice PDF
 * @param {Object} payment - Payment document
 * @param {Object} jobCard - JobCard document with populated fields
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateInvoicePDF = async (payment, jobCard) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Invoice ${payment.paymentNumber}`,
          Author: config.garage?.name || "ClutchGear Auto Services",
        },
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // Colors
      const primaryColor = "#DC2626";
      const textColor = "#0F172A";
      const mutedColor = "#64748B";
      const borderColor = "#E2E8F0";

      // Header Section
      doc
        .fontSize(24)
        .fillColor(primaryColor)
        .font("Helvetica-Bold")
        .text(config.garage?.name || "ClutchGear Auto Services", 50, 50);

      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text(config.garage?.address || "Vehicle Service Center", 50, 80)
        .text(config.garage?.phone || "Contact: Support", 50, 95)
        .text(config.garage?.email || "", 50, 110);

      // Invoice Title
      doc
        .fontSize(28)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text("INVOICE", 400, 50, { align: "right" });

      // Invoice Details Box
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Invoice No:", 400, 90, { align: "right" });
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(payment.paymentNumber, 400, 105, { align: "right" });

      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Date:", 400, 125, { align: "right" });
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(
          new Date(payment.createdAt).toLocaleDateString("en-IN"),
          400,
          140,
          {
            align: "right",
          }
        );

      // Divider
      doc.moveTo(50, 160).lineTo(545, 160).strokeColor(borderColor).stroke();

      // Bill To Section
      let yPos = 180;
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica-Bold")
        .text("BILL TO:", 50, yPos);

      yPos += 20;
      const customer = jobCard.customer || {};
      doc
        .fontSize(12)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(customer.name || "Walk-in Customer", 50, yPos);

      yPos += 18;
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text(customer.mobile || "", 50, yPos);

      if (customer.email) {
        yPos += 15;
        doc.text(customer.email, 50, yPos);
      }

      if (customer.address?.street) {
        yPos += 15;
        const addr = customer.address;
        doc.text(
          `${addr.street}, ${addr.city || ""} ${addr.state || ""} ${
            addr.pincode || ""
          }`,
          50,
          yPos
        );
      }

      // Vehicle Details (right side)
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica-Bold")
        .text("VEHICLE:", 350, 180);

      const vehicle = jobCard.vehicleSnapshot || jobCard.vehicle || {};
      doc
        .fontSize(12)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(vehicle.vehicleNumber || "N/A", 350, 200);

      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text(`${vehicle.brand || ""} ${vehicle.model || ""}`, 350, 218)
        .text(`Job No: ${jobCard.jobNumber || "N/A"}`, 350, 233);

      // Items Table Header
      yPos = 280;
      doc.rect(50, yPos, 495, 25).fillColor("#F8FAFC").fill();

      doc
        .fontSize(9)
        .fillColor(mutedColor)
        .font("Helvetica-Bold")
        .text("DESCRIPTION", 60, yPos + 8)
        .text("QTY", 320, yPos + 8, { width: 40, align: "center" })
        .text("RATE", 370, yPos + 8, { width: 60, align: "right" })
        .text("AMOUNT", 450, yPos + 8, { width: 80, align: "right" });

      // Table Items
      yPos += 30;
      const items = jobCard.jobItems || [];

      items.forEach((item) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const itemType = item.type === "part" ? "🔧" : "🛠️";

        doc
          .fontSize(10)
          .fillColor(textColor)
          .font("Helvetica")
          .text(`${itemType} ${item.description}`, 60, yPos, { width: 250 })
          .text(item.quantity?.toString() || "1", 320, yPos, {
            width: 40,
            align: "center",
          })
          .text(
            `₹${(item.unitPrice || 0).toLocaleString("en-IN")}`,
            370,
            yPos,
            {
              width: 60,
              align: "right",
            }
          )
          .text(`₹${(item.total || 0).toLocaleString("en-IN")}`, 450, yPos, {
            width: 80,
            align: "right",
          });

        yPos += 25;

        // Item divider
        doc
          .moveTo(50, yPos)
          .lineTo(545, yPos)
          .strokeColor(borderColor)
          .stroke();

        yPos += 10;
      });

      // If no items, show a placeholder
      if (items.length === 0) {
        doc
          .fontSize(10)
          .fillColor(mutedColor)
          .font("Helvetica-Oblique")
          .text("No itemized charges", 60, yPos);
        yPos += 30;
      }

      // Totals Section
      yPos = Math.max(yPos + 20, 500);
      const billing = jobCard.billing || {};

      // Subtotal
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Subtotal:", 350, yPos, { width: 80, align: "right" })
        .fillColor(textColor)
        .text(
          `₹${(billing.subtotal || 0).toLocaleString("en-IN")}`,
          450,
          yPos,
          {
            width: 80,
            align: "right",
          }
        );

      // Tax
      yPos += 20;
      if (billing.tax > 0) {
        doc
          .fillColor(mutedColor)
          .text(`Tax (${billing.taxRate || 18}%):`, 350, yPos, {
            width: 80,
            align: "right",
          })
          .fillColor(textColor)
          .text(`₹${(billing.tax || 0).toLocaleString("en-IN")}`, 450, yPos, {
            width: 80,
            align: "right",
          });
        yPos += 20;
      }

      // Discount
      if (billing.discount > 0) {
        doc
          .fillColor(mutedColor)
          .text("Discount:", 350, yPos, { width: 80, align: "right" })
          .fillColor("#10B981")
          .text(
            `-₹${(billing.discount || 0).toLocaleString("en-IN")}`,
            450,
            yPos,
            {
              width: 80,
              align: "right",
            }
          );
        yPos += 20;
      }

      // Grand Total Box
      yPos += 10;
      doc.rect(350, yPos, 195, 35).fillColor(primaryColor).fill();

      doc
        .fontSize(11)
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .text("GRAND TOTAL:", 360, yPos + 10, { width: 80 })
        .fontSize(14)
        .text(
          `₹${(billing.grandTotal || payment.amount || 0).toLocaleString(
            "en-IN"
          )}`,
          450,
          yPos + 8,
          { width: 80, align: "right" }
        );

      // Payment Status
      yPos += 50;
      const statusColors = {
        completed: "#10B981",
        pending: "#F59E0B",
        failed: "#EF4444",
        refunded: "#6B7280",
      };

      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Payment Status:", 350, yPos, { width: 80, align: "right" });

      doc
        .fillColor(statusColors[payment.status] || mutedColor)
        .font("Helvetica-Bold")
        .text(payment.status?.toUpperCase() || "PENDING", 450, yPos, {
          width: 80,
          align: "right",
        });

      // Payment Method
      yPos += 18;
      doc
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Payment Method:", 350, yPos, { width: 80, align: "right" })
        .fillColor(textColor)
        .text((payment.method || "N/A").toUpperCase(), 450, yPos, {
          width: 80,
          align: "right",
        });

      // Footer
      yPos = 750;
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor(borderColor).stroke();

      doc
        .fontSize(9)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Thank you for choosing our services!", 50, yPos + 15, {
          align: "center",
          width: 495,
        })
        .text(
          "For any queries, please contact our support team.",
          50,
          yPos + 30,
          { align: "center", width: 495 }
        );

      // Terms (if configured)
      if (config.garage?.invoiceTerms) {
        doc
          .fontSize(8)
          .fillColor(mutedColor)
          .text(`Terms: ${config.garage.invoiceTerms}`, 50, yPos + 50, {
            align: "center",
            width: 495,
          });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate simple receipt PDF
 * @param {Object} payment - Payment document
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateReceiptPDF = async (payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [226, 400], // 80mm receipt width
        margin: 15,
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(config.garage?.name || "ClutchGear", { align: "center" })
        .fontSize(8)
        .font("Helvetica")
        .text("PAYMENT RECEIPT", { align: "center" })
        .moveDown(0.5);

      // Divider
      doc.text("--------------------------------", { align: "center" });

      // Receipt Details
      doc
        .fontSize(9)
        .text(`Receipt: ${payment.paymentNumber}`)
        .text(`Date: ${new Date(payment.createdAt).toLocaleString("en-IN")}`)
        .text(`Method: ${payment.method?.toUpperCase()}`)
        .moveDown(0.5);

      doc.text("--------------------------------", { align: "center" });

      // Amount
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(`Amount: ₹${payment.amount.toLocaleString("en-IN")}`, {
          align: "center",
        })
        .moveDown(0.5);

      // Status
      doc
        .fontSize(9)
        .font("Helvetica")
        .text(`Status: ${payment.status?.toUpperCase()}`, { align: "center" });

      doc.text("--------------------------------", { align: "center" });

      // Footer
      doc
        .fontSize(8)
        .text("Thank you!", { align: "center" })
        .text("Visit again", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateInvoicePDF,
  generateReceiptPDF,
};

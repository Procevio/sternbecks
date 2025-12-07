window.buildOfferPreview = function buildOfferPreview({
  customer,
  calc,
  offerText,
  items,
  conditions,
  date,
  city
}) {
  // Bygg HTML som matchar PDF-layouten strukturellt
  return `
    <div class="offer-preview">

      <h1>Offert</h1>

      <div class="preview-header">
        <div>
          <p>Sternbecks Måleri & Fönsterhantverk</p>
          <p>${date}</p>
        </div>
        <img src="assets/images/Sternbecks logotyp.png" class="preview-logo" />
      </div>

      <h2>Kund</h2>
      <div class="preview-kund">
        ${customer.company || ""}<br>
        ${customer.contact || ""}<br>
        ${customer.address || ""}<br>
        ${customer.postal || ""} ${customer.city || ""}<br>
        Telefon: ${customer.phone || ""}<br>
        E-post: ${customer.email || ""}
      </div>

      <h2>ANBUD</h2>
      <div class="preview-anbud">
        ${offerText}
      </div>

      <h2>Arbetsmoment / artiklar</h2>
      <table class="preview-items">
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${i.name}</td>
              <td class="right">${i.priceExVat} kr</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="preview-summary">
        <div class="summary-box">
          <h3>Totalpris</h3>
          <div class="right">${calc.total_excl_vat} kr</div>
        </div>

        <p>Pris exkl. moms: <span class="right">${calc.total_excl_vat} kr</span></p>
        <p>Moms: <span class="right">${calc.vat_amount} kr</span></p>
        <p>Totalpris inkl. moms: <span class="right">${calc.total_incl_vat} kr</span></p>

        ${calc.rot_applicable ? `
          <p>ROT-avdrag: <span class="right">-${calc.rot_deduction} kr</span></p>
        ` : ""}

        <p class="bold">KUNDEN BETALAR: ${calc.customer_pays} kr</p>
      </div>

      <h2>För anbudet gäller:</h2>
      <ul class="preview-conditions">
        ${conditions.map(c => `<li>${c}</li>`).join("")}
      </ul>

      <div class="preview-signature">
        ${city} ${date}<br>
        Johan Sternbeck<br>
        Sternbecks Fönsterhantverk i Dalarna AB<br>
        Lavendelstigen 7<br>
        77143 Ludvika<br>
        Org.nr 559389-0717<br>
        Tel.nr 076-846 52 79 – Företaget innehar F-skatt
      </div>

    </div>
  `;
};


export const privacyAckKey = "privacy-ack";

export const privacyAckAttribute = "data-privacy-ack";

export const privacyAckScript = `try{if(localStorage.getItem("${privacyAckKey}"))document.documentElement.setAttribute("${privacyAckAttribute}","")}catch{}`;

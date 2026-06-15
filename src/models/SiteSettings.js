import mongoose from 'mongoose';

const siteSettingsSchema = new mongoose.Schema({
  storeName: {
    type: String,
    default: "AMAR JEANS"
  },
  supportEmail: {
    type: String,
    default: "contact@amarjeans.com"
  },
  supportPhone: {
    type: String,
    default: "+91 9834557990 / +91 8149987987"
  },
  storeAddress: {
    type: String,
    default: "opp new fire brigade Chinchpada nalambi road amb (w)\nchnchpad rood new fire brigade opp titwala road ambernath w, Ambarnath 421501"
  },
  instagramUrl: {
    type: String,
    default: "https://www.instagram.com/amarjeans990/"
  }
}, { timestamps: true });

// Ensure only one document is created
siteSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);

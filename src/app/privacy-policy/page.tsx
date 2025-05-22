
// src/app/privacy-policy/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { FileText, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicyPage() {
  // Basic placeholder text. Replace with your actual privacy policy.
  const privacyPolicyText = `
Privacy Policy for Kratia Forums
Last Updated: ${new Date().toLocaleDateString()}

Welcome to Kratia Forums ("us", "we", or "our"). We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information, please contact us.

When you visit our website kratiaforums.com (the "Website"), and more generally, use any of our services (the "Services", which include the Website), we appreciate that you are trusting us with your personal information. We take your privacy very seriously. In this privacy notice, we seek to explain to you in the clearest way possible what information we collect, how we use it and what rights you have in relation to it. We hope you take some time to read through it carefully, as it is important. If there are any terms in this privacy notice that you do not agree with, please discontinue use of our Services immediately.

This privacy notice applies to all information collected through our Services (which, as described above, includes our Website), as well as, any related services, sales, marketing or events.

**1. WHAT INFORMATION DO WE COLLECT?**

**Personal information you disclose to us**
We collect personal information that you voluntarily provide to us when you register on the Website, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Website (such as posting messages in our online forums or entering competitions, contests or giveaways) or otherwise when you contact us.

The personal information that we collect depends on the context of your interactions with us and the Website, the choices you make and the products and features you use. The personal information we collect may include the following:
* Names
* Email addresses
* Usernames
* Passwords (stored securely and hashed)
* Contact preferences
* User-generated content (forum posts, messages, profile information)
* IP addresses (collected automatically)
* Usage Data (collected automatically)

**Information automatically collected**
We automatically collect certain information when you visit, use or navigate the Website. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Website and other technical information. This information is primarily needed to maintain the security and operation of our Website, and for our internal analytics and reporting purposes.

Like many businesses, we also collect information through cookies and similar technologies.

**2. HOW DO WE USE YOUR INFORMATION?**

We use personal information collected via our Website for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations. We indicate the specific processing grounds we rely on next to each purpose listed below.

We use the information we collect or receive:
* **To facilitate account creation and logon process.** If you choose to link your account with us to a third-party account (such as your Google account), we use the information you allowed us to collect from those third parties to facilitate account creation and logon process for the performance of the contract.
* **To post testimonials.** We post testimonials on our Website that may contain personal information.
* **Request feedback.** We may use your information to request feedback and to contact you about your use of our Website.
* **To manage user accounts.** We may use your information for the purposes of managing our account and keeping it in working order.
* **To send administrative information to you.**
* **To protect our Services.**
* **To enforce our terms, conditions and policies for business purposes, to comply with legal and regulatory requirements or in connection with our contract.**
* **To respond to legal requests and prevent harm.**
* **Fulfill and manage your orders.**
* **Administer prize draws and competitions.**
* **To deliver and facilitate delivery of services to the user.**
* **To respond to user inquiries/offer support to users.**
* **To send you marketing and promotional communications.**
* **Deliver targeted advertising to you.**

**3. WILL YOUR INFORMATION BE SHARED WITH ANYONE?**

We may process or share your data that we hold based on the following legal basis:
* Consent
* Legitimate Interests
* Performance of a Contract
* Legal Obligations
More specifically, we may need to process your data or share your personal information in the following situations: Business Transfers, Affiliates, Business Partners.

**4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?**

We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice.

**5. HOW DO WE HANDLE YOUR SOCIAL LOGINS?**

If you choose to register or log in to our services using a social media account, we may have access to certain information about you.

**6. HOW LONG DO WE KEEP YOUR INFORMATION?**

We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy notice, unless a longer retention period is required or permitted by law.

**7. HOW DO WE KEEP YOUR INFORMATION SAFE?**

We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process.

**8. WHAT ARE YOUR PRIVACY RIGHTS?**

In some regions (like the European Economic Area and the United Kingdom), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; and (iv) if applicable, to data portability. In certain circumstances, you may also have the right to object to the processing of your personal information.

**9. CONTROLS FOR DO-NOT-TRACK FEATURES**

Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected.

**10. DO CALIFORNIA RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?**

Yes, if you are a resident of California, you are granted specific rights regarding access to your personal information.

**11. DO WE MAKE UPDATES TO THIS NOTICE?**

Yes, we will update this notice as necessary to stay compliant with relevant laws.

**12. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?**

If you have questions or comments about this notice, you may email us at [Your Contact Email Address] or by post to:
[Your Company Name, if applicable]
[Your Address, if applicable]
[City, State, Zip/Postal Code]
[Country]

**13. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?**

Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, change that information, or delete it in some circumstances. To request to review, update, or delete your personal information, please submit a request form by clicking here [Link to a Data Request Form or Contact Page].
  `;

  return (
    <div className="space-y-8">
       <Button variant="outline" asChild className="mb-6">
          <Link href="/">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Homepage
          </Link>
        </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center">
            <FileText className="mr-3 h-8 w-8 text-primary" />
            Privacy Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-20rem)] p-1 sm:p-4 border rounded-md bg-background/50">
            <div
              className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none dark:prose-invert whitespace-pre-line"
              dangerouslySetInnerHTML={{
                __html: privacyPolicyText
                  .replace(/^(\*\*.*?\*\*)$/gm, '<h3>$1</h3>') // Section titles
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                  .replace(/\*(.*?)\*/g, '<em>$1</em>'), // Italics
              }}
            />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

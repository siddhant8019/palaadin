"""Grounded search can return pages about a different company. Those must never become sources."""

from paladin.fetch import Page
from paladin.research import mentions_account


def _page(url, text):
    return Page(url=url, requested_url=url, status=200, text=text)


def test_own_site_is_accepted():
    assert mentions_account(_page("https://www.attio.com/about", "About us"), "Attio", "attio.com")


def test_third_party_page_naming_the_company_is_accepted():
    page = _page("https://tracxn.com/d/companies/attio", "Attio is a CRM company headquartered in London.")
    assert mentions_account(page, "Attio", "attio.com")


def test_page_about_another_company_is_rejected():
    page = _page("https://example-news.test/story", "Acme Corp raised a Series C to expand in Denver.")
    assert not mentions_account(page, "Nonexistent Co", "paladin-eval-nonexistent.invalid")


def test_short_names_need_the_domain():
    # A 3-letter name like "Box" would match almost any page, so it only counts via the domain.
    page = _page("https://blog.test/post", "Put it in a box and ship it.")
    assert not mentions_account(page, "Box", "box.com")

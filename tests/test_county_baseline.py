from floodiq.baseline.county import percentile_in_county


def test_no_baseline_when_sample_too_small():
    result = percentile_in_county(50, county_fips="06075", additional_scores=[40, 60])
    assert result.percentile is None
    assert result.sample_size == 2


def test_median_lands_near_50():
    scores = list(range(0, 100))  # 100 evenly spaced
    result = percentile_in_county(50, county_fips="06075", additional_scores=scores)
    assert result.percentile is not None
    assert 49 <= result.percentile <= 51


def test_max_score_lands_near_100():
    scores = list(range(0, 100))
    result = percentile_in_county(99, county_fips="06075", additional_scores=scores)
    assert result.percentile is not None
    assert result.percentile >= 99


def test_min_score_lands_near_0():
    scores = list(range(0, 100))
    result = percentile_in_county(0, county_fips="06075", additional_scores=scores)
    assert result.percentile is not None
    assert result.percentile <= 1


def test_tie_share_reports_fraction_of_county_with_same_score():
    from floodiq.baseline.county import is_typical_for_county

    # DC-like county: every sampled tract is Zone X with the same composite.
    flat = [10.0] * 25
    result = percentile_in_county(10.0, county_fips="11001", additional_scores=flat)
    assert result.percentile == 50.0  # mid-rank of a full tie
    assert result.tie_share == 1.0
    assert is_typical_for_county(result.tie_share)


def test_varied_county_is_not_typical():
    from floodiq.baseline.county import is_typical_for_county

    scores = list(range(0, 100))
    result = percentile_in_county(50, county_fips="06075", additional_scores=scores)
    assert result.tie_share == 0.01
    assert not is_typical_for_county(result.tie_share)

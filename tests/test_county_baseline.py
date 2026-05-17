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
